use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;
use std::sync::{Arc, Mutex};
use serde::{Serialize, Deserialize};
use rand::{thread_rng, RngCore, Rng};
use rusqlite::{Connection, Result as SqliteResult, params};


#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
enum Type {
    Buy,
    Sell,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
enum Currency {
    Sat,
    Brl,
    Usd,
    Eur,
    Chf,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct OrderRequest {
    kind: Type,
    make_amount: f32,
    make_denomination: Currency,
    take_amount: f32,
    take_denomination: Currency,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Order {
    id: String,
    kind: Type,
    make_amount: f32,
    make_denomination: Currency,
    take_amount: f32,
    take_denomination: Currency,
}

fn init_db() -> SqliteResult<Connection> {
    let conn = Connection::open("granola.db")?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            make_amount REAL NOT NULL,
            make_denomination TEXT NOT NULL,
            take_amount REAL NOT NULL,
            take_denomination TEXT NOT NULL
        )",
        [],
    )?;
    
    Ok(conn)
}

fn generate_id() -> String {
    let mut rng = thread_rng();
    let mut bytes = [0u8; 32];
    rng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn main() -> SqliteResult<()> {
    let conn = init_db()?;

    generate_fake_orders(&conn, 7)?;

    let listener = TcpListener::bind("127.0.0.1:8080").unwrap();
    println!("Server listening on port 8080");
    
    let conn = Arc::new(Mutex::new(conn));
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let conn_clone = Arc::clone(&conn);
                thread::spawn(move || {
                    handle_connection(stream, conn_clone);
                });
            }
            Err(e) => {
                eprintln!("Error accepting connection: {}", e);
            }
        }
    }

    Ok(())
}

fn handle_connection(mut stream: TcpStream, orders: Arc<Mutex<Connection>>) {
    let mut buffer = [0; 4096];
    
    match stream.read(&mut buffer) {
        Ok(size) => {
            let request = String::from_utf8_lossy(&buffer[..size]);
            let request_line = request.lines().next().unwrap_or("");
            let parts: Vec<&str> = request_line.split_whitespace().collect();
            
            if parts.len() >= 2 {
                let method = parts[0];
                let path = parts[1];
                
                let response = match (method, path) {
                    ("OPTIONS", _) => create_options_response(),
                    ("GET", "/orders") => handle_get_orders(&orders),
                    ("POST", "/order") => handle_post_order(&request, &orders),
                    ("DELETE", path) if path.starts_with("/order/") => 
                        handle_delete_order(path, &orders),
                    _ => create_json_response(404, "Not Found", 
                        "{\"error\": \"Endpoint not found\"}"),
                };
                
                if let Err(e) = stream.write_all(response.as_bytes()) {
                    eprintln!("Error sending response: {}", e);
                }
            }
        }
        Err(e) => {
            eprintln!("Error reading from connection: {}", e);
        }
    }
}

fn handle_get_orders(conn: &Arc<Mutex<Connection>>) -> String {
    let conn_guard = conn.lock().unwrap();
    let mut stmt = match conn_guard.prepare("SELECT * FROM orders") {
        Ok(stmt) => stmt,
        Err(e) => return create_json_response(500, "Internal Server Error", 
            &format!("{{\"error\": \"Database error: {}\"}}", e)),
    };
    
    let orders_iter = match stmt.query_map([], |row| {
        Ok(Order {
            id: row.get(0)?,
            kind: serde_json::from_str(&row.get::<_, String>(1)?).unwrap(),
            make_amount: row.get(2)?,
            make_denomination: serde_json::from_str(&row.get::<_, String>(3)?).unwrap(),
            take_amount: row.get(4)?,
            take_denomination: serde_json::from_str(&row.get::<_, String>(5)?).unwrap(),
        })
    }) {
        Ok(orders) => orders,
        Err(e) => return create_json_response(500, "Internal Server Error", 
            &format!("{{\"error\": \"Database error: {}\"}}", e)),
    };

    let orders: Vec<Order> = orders_iter.filter_map(Result::ok).collect();
    match serde_json::to_string(&orders) {
        Ok(json) => create_json_response(200, "OK", &json),
        Err(e) => create_json_response(500, "Internal Server Error", 
            &format!("{{\"error\": \"JSON serialization error: {}\"}}", e)),
    }
}

fn handle_post_order(request: &str, conn: &Arc<Mutex<Connection>>) -> String {
    if let Some(body) = request.split("\r\n\r\n").nth(1) {
        match serde_json::from_str::<OrderRequest>(body) {
            Ok(order_request) => {
                let id = generate_id();
                let order = Order {
                    id: id.clone(),
                    kind: order_request.kind,
                    make_amount: order_request.make_amount,
                    make_denomination: order_request.make_denomination,
                    take_amount: order_request.take_amount,
                    take_denomination: order_request.take_denomination,
                };
                
                let conn_guard = conn.lock().unwrap();
                let result = conn_guard.execute(
                    "INSERT INTO orders (id, kind, make_amount, make_denomination, take_amount, take_denomination) 
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        order.id,
                        serde_json::to_string(&order.kind).unwrap(),
                        order.make_amount,
                        serde_json::to_string(&order.make_denomination).unwrap(),
                        order.take_amount,
                        serde_json::to_string(&order.take_denomination).unwrap(),
                    ],
                );

                match result {
                    Ok(_) => create_json_response(201, "Created", &serde_json::to_string(&order).unwrap()),
                    Err(e) => create_json_response(500, "Internal Server Error", 
                        &format!("{{\"error\": \"Database error: {}\"}}", e)),
                }
            }
            Err(e) => create_json_response(400, "Bad Request", 
                &format!("{{\"error\": \"Invalid JSON: {}\"}}", e)),
        }
    } else {
        create_json_response(400, "Bad Request", 
            "{\"error\": \"Missing request body\"}")
    }
}

fn handle_delete_order(path: &str, conn: &Arc<Mutex<Connection>>) -> String {
    let order_id = &path[7..]; // Skip "/order/"
    let conn_guard = conn.lock().unwrap();
    
    match conn_guard.execute("DELETE FROM orders WHERE id = ?1", [order_id]) {
        Ok(rows) => {
            if rows > 0 {
                create_json_response(200, "OK", 
                    &format!("{{\"message\": \"Order {} deleted successfully\"}}", order_id))
            } else {
                create_json_response(404, "Not Found", 
                    &format!("{{\"error\": \"Order {} not found\"}}", order_id))
            }
        }
        Err(e) => create_json_response(500, "Internal Server Error", 
            &format!("{{\"error\": \"Database error: {}\"}}", e)),
    }
}

fn create_options_response() -> String {
    "HTTP/1.1 204 No Content\r\n\
     Access-Control-Allow-Origin: *\r\n\
     Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS\r\n\
     Access-Control-Allow-Headers: Content-Type, Origin, Accept\r\n\
     Access-Control-Max-Age: 86400\r\n\
     Content-Length: 0\r\n\r\n".to_string()
}

fn create_json_response(status_code: u32, status_text: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {} {}\r\n\
         Content-Type: application/json\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS\r\n\
         Access-Control-Allow-Headers: Content-Type, Origin, Accept\r\n\
         Content-Length: {}\r\n\r\n{}",
        status_code,
        status_text,
        body.len(),
        body
    )
}

fn generate_fake_orders(conn: &Connection, count: u32) -> SqliteResult<()> {
    let types = vec![Type::Buy, Type::Sell];
    let currencies = vec![
        Currency::Sat,
        Currency::Brl,
        Currency::Usd,
        Currency::Eur,
        Currency::Chf
    ];
    
    let mut rng = thread_rng();
    
    for _ in 0..count {
        let kind = types[rng.gen_range(0..types.len())].clone();
        let make_denomination = currencies[rng.gen_range(0..currencies.len())].clone();
        let take_denomination = currencies[rng.gen_range(0..currencies.len())].clone();
        
        let (make_amount, take_amount) = match (make_denomination.clone(), take_denomination.clone()) {
            (Currency::Sat, Currency::Brl) => (
                rng.gen_range(1.0..100.0),
                rng.gen_range(1.0..100.0)
            ),
            (Currency::Brl, Currency::Sat) => (
                rng.gen_range(1.0..100.0),
                rng.gen_range(1.0..100.0)
            ),
            (Currency::Sat, Currency::Usd) => (
                rng.gen_range(1.0..100.0),
                rng.gen_range(1.0..100.0)
            ),
            _ => (
                rng.gen_range(1.0..100.0),
                rng.gen_range(1.0..100.0)
            ),
        };

        let order = Order {
            id: generate_id(),
            kind: kind.clone(),
            make_amount,
            make_denomination,
            take_amount,
            take_denomination,
        };

        // Handle JSON serialization errors explicitly
        let kind_json = serde_json::to_string(&order.kind)
            .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?;
            
        let make_denom_json = serde_json::to_string(&order.make_denomination)
            .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?;
            
        let take_denom_json = serde_json::to_string(&order.take_denomination)
            .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?;

        conn.execute(
            "INSERT INTO orders (id, kind, make_amount, make_denomination, take_amount, take_denomination) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                order.id,
                kind_json,
                order.make_amount,
                make_denom_json,
                order.take_amount,
                take_denom_json,
            ],
        )?;
    }

    Ok(())
}