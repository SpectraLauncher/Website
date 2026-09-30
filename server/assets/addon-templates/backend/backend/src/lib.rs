use extism_pdk::*;
use serde_json::{json, Map, Value};

#[host_fn]
extern "ExtismHost" {
    fn spectra_call(request: String) -> String;
}

fn spectra(method: &str, params: Value) -> Result<Value, Error> {
    let request = json!({ "method": method, "params": params }).to_string();
    let reply: Value = serde_json::from_str(&unsafe { spectra_call(request)? })?;
    match reply.get("error") {
        Some(error) => Err(Error::msg(error.to_string())),
        None => Ok(reply.get("result").cloned().unwrap_or(Value::Null)),
    }
}

#[plugin_fn]
pub fn summary(_input: String) -> FnResult<Json<Value>> {
    let instances = spectra("instances.list", json!({}))?;
    let instances = instances.as_array().cloned().unwrap_or_default();

    let playtime: u64 = instances.iter().filter_map(|i| i["playtimeSeconds"].as_u64()).sum();
    let mut loaders = Map::new();
    for instance in &instances {
        let loader = instance["loader"]["type"].as_str().unwrap_or("vanilla").to_string();
        let count = loaders.get(&loader).and_then(Value::as_u64).unwrap_or(0);
        loaders.insert(loader, json!(count + 1));
    }

    Ok(Json(json!({
        "instances": instances.len(),
        "playtimeSeconds": playtime,
        "loaders": loaders,
    })))
}
