When JavaScript is not the right tool, an addon can ship `backend.wasm`: a
WebAssembly module the launcher runs with [Extism](https://extism.org). Pages call
its functions, and it reaches the launcher through the same permissions as the
pages do.

## Declaring it

```json
{
  "backend": "backend.wasm",
  "permissions": ["instances:read"]
}
```

## Calling it from a page

```js
const summary = await spectra.backend.call('summary', { detailed: true })
```

The input is passed as JSON bytes. What the function returns comes back parsed as
JSON when it is JSON, and as text otherwise.

## Calling the launcher from the backend

The launcher gives the module one host function, `spectra_call`. It takes a JSON
string `{ "method": "...", "params": { ... } }` and answers
`{ "result": ... }` or `{ "error": { "code": "...", "message": "..." } }`. The
methods and their permissions are the same as on `window.spectra`, except the ones
that only make sense on a page: `ui.*`, `instances.launch`, `launcher.locale` and
`launcher.theme`.

## Rust

```toml
[lib]
crate-type = ["cdylib"]

[dependencies]
extism-pdk = "1.4"
serde_json = "1"
```

```rust
use extism_pdk::*;
use serde_json::{json, Value};

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
    Ok(Json(json!({ "instances": instances.as_array().map_or(0, Vec::len) })))
}
```

```sh
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/<crate>.wasm backend.wasm
```

Other languages work the same way through their Extism kit: export functions and
import `spectra_call` from the `extism:host/user` namespace.

## Limits

- 64 MB of memory and 5 seconds per call; a function that runs longer is stopped
- no WASI: no files, no clock, no network except through `spectra_call`
- a function name may only use letters, digits and underscores

The Backend template is a complete example with a page and the Rust source.
