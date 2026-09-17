fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        cc::Build::new()
            .cpp(true)
            .file("src/ffb_windows.cpp")
            .flag_if_supported("/std:c++17")
            .flag_if_supported("-std=c++17")
            .compile("stunts_ffb");
        println!("cargo:rustc-link-lib=dinput8");
        println!("cargo:rustc-link-lib=dxguid");
    }
    tauri_build::build()
}
