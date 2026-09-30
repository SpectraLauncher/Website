# My backend

A page that hands its work to `backend.wasm`, a WebAssembly module built from the Rust code in `backend/` with
[extism-pdk](https://github.com/extism/rust-pdk).

```sh
rustup target add wasm32-unknown-unknown
cd backend
cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/my_backend.wasm ../backend.wasm
```

The page calls a backend function with `spectra.backend.call('summary', input)`. The backend reaches the launcher
through one host function, `spectra_call`, which takes `{ "method": "...", "params": { ... } }` and answers
`{ "result": ... }` or `{ "error": { "code": "...", "message": "..." } }`. The methods and permissions are the same as
for `window.spectra`, except the ones that only make sense on a page (`ui.*`, `instances.launch`, `launcher.locale`,
`launcher.theme`).

Each call gets 64 MB of memory and 5 seconds. There is no WASI: no files, clock or network except through
`spectra_call`. Delete `backend/target` before you zip the addon.
