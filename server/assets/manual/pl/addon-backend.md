Gdy JavaScript to złe narzędzie, addon może dołączyć `backend.wasm`: moduł
WebAssembly, który launcher uruchamia przez [Extism](https://extism.org). Strony
wywołują jego funkcje, a on sięga do launchera przez te same uprawnienia co strony.

## Deklaracja

```json
{
  "backend": "backend.wasm",
  "permissions": ["instances:read"]
}
```

## Wywołanie ze strony

```js
const summary = await spectra.backend.call('summary', { detailed: true })
```

Wejście trafia do funkcji jako bajty JSON. Wynik wraca sparsowany, jeśli jest
JSON-em, a w przeciwnym razie jako tekst.

## Wywołanie launchera z backendu

Launcher daje modułowi jedną funkcję hosta, `spectra_call`. Przyjmuje tekst JSON
`{ "method": "...", "params": { ... } }` i odpowiada `{ "result": ... }` albo
`{ "error": { "code": "...", "message": "..." } }`. Metody i uprawnienia są te same
co w `window.spectra`, poza tymi, które mają sens tylko na stronie: `ui.*`,
`instances.launch`, `launcher.locale` i `launcher.theme`.

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

Inne języki działają tak samo przez swój zestaw Extism: eksportują funkcje i
importują `spectra_call` z przestrzeni `extism:host/user`.

## Limity

- 64 MB pamięci i 5 sekund na wywołanie; dłuższa funkcja zostaje przerwana
- bez WASI: bez plików, zegara i sieci, poza `spectra_call`
- nazwa funkcji może zawierać tylko litery, cyfry i podkreślenia

Szablon Backend to pełny przykład ze stroną i kodem w Rust.
