# PlayStunts DX

**PlayStunts DX** is a native Windows desktop fork of [PlayStunts](https://github.com/ACatWithEbola/playstunts), the reconstructed **Stunts / 4D Sports Driving** runtime.

The original PlayStunts reconstruction was created by **Sven (@ACatWithEbola)**. PlayStunts DX builds on that work and adds a Windows/Tauri frontend, gamepad and steering-wheel support, native force feedback, high-resolution assets, custom cars and tracks, and a portable Windows release.

The original **Stunts / 4D Sports Driving** game was developed by **Distinctive Software**.

**No original Stunts game files or Roland MT-32 ROMs are included.** You must supply those yourself.

## Requirements

PlayStunts DX currently targets **64-bit Windows 10/11**.

Most build requirements can be installed directly from PowerShell:

```powershell
winget install -e --id Git.Git
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id Python.Python.3.12
winget install -e --id Rustlang.Rustup
winget install -e --id Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
winget install -e --id Microsoft.EdgeWebView2Runtime
```

After installation, close and reopen PowerShell, then run:

```powershell
rustup default stable-x86_64-pc-windows-msvc
rustup update
cargo install tauri-cli --version "^2.0.0" --locked
```

Node.js **24 or newer** is required. Check with:

```powershell
node --version
```

## Clone and build

```powershell
git clone https://github.com/Endprodukt/playstuntsdx.git
cd playstuntsdx
git switch master
npm.cmd ci
```

### Run the development version

```powershell
git pull
npm.cmd run desktop:dev
```

### Build the complete portable version

This is the recommended build:

```powershell
npm.cmd run desktop:portable
```

The finished build is created in:

```text
release\PlayStunts DX\
```

For only the compiled release executable:

```powershell
npm.cmd run desktop:build
```

Output:

```text
src-tauri\target\release\playstuntsdx.exe
```

## Game files and folders

The portable build creates the important folders automatically:

```text
PlayStunts DX.exe
config.ini
Gamedata\
Custom Cars\
Custom Tracks\
High Res\
mt32\
```

Put your compatible original **Stunts / 4D Sports Driving** files in `Gamedata` before launching the game.

- `Custom Cars` — custom car files
- `Custom Tracks` — custom tracks
- `High Res` — high-resolution replacement assets
- `mt32` — optional user-supplied MT-32 ROMs
- `config.ini` — desktop, controller and force-feedback settings

The supported original game data is based on the **Mindscape 4D Sports Driving 1.1 release from 13 December 1990**.

## Credits

PlayStunts DX would not exist without the work that came before it.

A huge thank you goes to **Sven / [@ACatWithEbola](https://github.com/ACatWithEbola)** for creating the original **PlayStunts** reconstruction and making it possible to experience Stunts in a completely new way.

And of course, respect to **Distinctive Software**, the original developers of **Stunts / 4D Sports Driving**.

For me, this game is more than an old racing game. **Stunts accompanied me throughout my childhood. In the 1990s it seemed to be on every school PC I could get my hands on, and I spent countless hours building tracks, crashing cars and trying things the game was probably never meant to do.**

PlayStunts DX is my way of keeping that memory alive while pushing the game a little further — with modern Windows support, wheels, force feedback, higher-resolution graphics and all the other things I always wished it could have had back then.

Thanks to everyone who has worked on Stunts, preserved it, documented it, reconstructed it, modded it or simply kept playing it all these years.

## License

Source code in this repository is licensed under **GPL-3.0-only** unless a file states otherwise. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The license does not cover the original Stunts executables, artwork, game data or Roland ROMs. Those files are not distributed with PlayStunts DX.
