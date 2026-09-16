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
  cockpit\
mt32\
```

Put your compatible original **Stunts / 4D Sports Driving** files in `Gamedata` before launching the game.

The supported original game data is based on the **Mindscape 4D Sports Driving 1.1 release from 13 December 1990**.

## High-resolution textures

High-resolution replacements belong in `High Res`. Missing replacements simply use the normal game artwork, so you only need to add the files you actually want to replace.

The main menu replacement goes directly in the folder:

```text
High Res\
  main-menu.png
```

Cockpit artwork mirrors the original game asset structure and uses the four-character car ID as a subfolder:

```text
High Res\
  cockpit\
    COUN\
      dashboard.png
      whl1.png
      whl2.png
      whl3.png
```

`COUN` is only an example. Use the actual four-character ID of the car. Custom cars use their own ID in exactly the same way.

Replacement files must keep the same filename and aspect ratio as the original asset. Their pixel resolution may be higher. Additional cockpit images can be replaced as long as their filename matches the corresponding original cockpit file.

Enable **Enhanced Textures** in PlayStunts DX to use the replacements.

## Custom cars

Put custom Stunts cars in `Custom Cars`. Cars may be stored directly in the folder, in their own subfolders, or as ZIP archives.

A normal car package uses one four-character ID. For an example ID of `ABCD`, the required files are:

```text
CARABCD.RES
STABCD.P3S   (or STABCD.3SH)
STDAABCD.PVS (or STDAABCD.VSH)
STDBABCD.PVS (or STDBABCD.VSH)
```

A convenient layout is:

```text
Custom Cars\
  My Car\
    CARABCD.RES
    STABCD.P3S
    STDAABCD.PVS
    STDBABCD.PVS
```

PlayStunts DX supports up to **32 cars in total**, including the original cars. A custom car must use a unique four-character ID; it cannot replace an original or another loaded car with the same ID.

## Custom tracks

Put original-format `.TRK` files in `Custom Tracks`:

```text
Custom Tracks\
  MYTRACK.TRK
```

Subfolders are supported, so larger collections can be organized however you like:

```text
Custom Tracks\
  Favorites\
    LOOP.TRK
    JUMPS.TRK
```

Tracks must use the original Stunts `.TRK` format and be **1,802 bytes**. If two tracks have the same filename, only one can be loaded.

Custom cars and tracks are included when the runtime assets are generated. If you add or change them after a `Runtime` folder has already been created, delete the `Runtime` folder once and restart PlayStunts DX so it can be rebuilt with the new content.

## Other folders

- `mt32` — optional user-supplied MT-32 ROMs
- `config.ini` — desktop, controller, display and force-feedback settings
- `Runtime` — generated game assets; normally leave this folder alone

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