# Q-Sys Plugin Compiler

A Node.js command-line tool for compiling Q-Sys plugins with support for file inclusion and image encoding.

## Features

- **File Inclusion**: Embed Lua files using `#include` directives
- **Image Encoding**: Convert images to base64 and embed them directly in your plugin
- **Version Management**: Automatically increment plugin versions (major, minor, fix, dev)
- **UUID Generation**: Auto-generate unique plugin IDs
- **Circular Include Detection**: Prevents infinite loops from circular file dependencies
- **Use any IDE**: Configure this to run for build tasks in your IDE of choice

## Supported Image Formats

- PNG (`.png`)
- JPEG (`.jpg`, `.jpeg`)
- SVG (`.svg`)

## Installation

```bash
npm install
```

Ensure Node.js is installed on your system.

## Usage

### Basic Compilation

```bash
node qsys-compiler.js
```

Compiles the plugin using default settings (current directory, `plugin.lua` as main file).

### Command-Line Options

```bash
node qsys-compiler.js [options]
```

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--source` | `-s` | Source directory | Current directory |
| `--main` | `-m` | Main plugin file | `plugin.lua` |
| `--output` | `-o` | Output file name | Auto-generated from directory name |
| `--info` | `-i` | Info file name | `info.lua` |
| `--build-type` | `-b` | Version increment type | `ver_dev` |
| `--help` | `-h` | Show help message | — |

### Build Types

| Type | Behavior | Example |
|------|----------|---------|
| `ver_maj` | Increment major version | `1.0.0.0` → `2.0.0.0` |
| `ver_min` | Increment minor version | `1.0.0.0` → `1.1.0.0` |
| `ver_fix` | Increment fix version | `1.0.0.0` → `1.0.1.0` |
| `ver_dev` | Increment dev version (default) | `1.0.0.0` → `1.0.0.1` |

### Examples

```bash
# Compile with minor version increment
node qsys-compiler.js --build-type ver_min

# Compile from a specific directory with custom output name
node qsys-compiler.js --source ./my-plugin --output MyPlugin.qplug

# Specify all options
node qsys-compiler.js -s ./plugins/myapp -m main.lua -o compiled.qplug -b ver_fix
```

## File Inclusion

Use the `#include` directive to embed Lua files:

```lua
--[[ #include "helpers.lua" ]]
--[[ #include "lib/utilities.lua" ]]
```

The compiler will:
1. Find the referenced file relative to the source directory
2. Replace the directive with the file contents
3. Process any nested includes within the included file
4. Wrap the content with begin/end markers for clarity

### Circular Include Detection

The compiler detects and prevents circular includes:

```lua
-- file-a.lua
--[[ #include "file-b.lua" ]]

-- file-b.lua
--[[ #include "file-a.lua" ]]  -- This will trigger a warning
```

## Image Encoding

Use the `#encode` directive to embed images:

```lua
Logo = "--[[ #encode "logo.png" ]]"

table.insert(graphics, {
  Type="Image",
  Image=Logo,
  Position={0,0},
  Size={75,9}
})
```

For SVG files:

```lua
Icon = "--[[ #encode "icon.svg" ]]"

table.insert(graphics, {
  Type="svg",
  Image=Icon,
  Position={0,0},
  Size={75,9}
})
```

### Image Paths

Images can be placed in subdirectories relative to your source directory:

```lua
--[[ #encode "assets/images/logo.png" ]]
--[[ #encode "img/icons/settings.svg" ]]
```

### Output Format

- **PNG/JPEG**: Encoded as raw base64 string
- **SVG**: Encoded as raw base64 string

The compiler logs the size of each encoded image in kilobytes.

## Project Structure

```
my-plugin/
├── plugin.lua          # Main plugin file
├── info.lua            # Plugin information with version
├── helpers.lua         # Included via #include
├── assets/
│   └── logo.png        # Encoded via #encode
└── my-plugin.qplug     # Compiled output
```

## info.lua Format

The `info.lua` file should contain the plugin metadata:

```lua
Info = {
  Id = "<guid>",
  BuildVersion = "1.0.0.0",
  Name = "My Plugin"
}
```

- `<guid>`: Will be replaced with an auto-generated UUID
- `BuildVersion`: Will be incremented based on the build type

## Workflow

1. **Organize your files**: Structure your plugin with includes and images
2. **Use directives**: Add `#include` and `#encode` directives in your Lua code
3. **Compile**: Run the compiler with desired options
4. **Version management**: The tool automatically updates `info.lua` with new version and UUID
5. **Deploy**: Use the generated `.qplug` file in your Q-Sys environment

## Error Handling

The compiler provides helpful error messages:

- **File not found**: Warning if an included file or image doesn't exist
- **Circular includes**: Warning with filename if a circular dependency is detected
- **Encoding errors**: Error message if an image can't be read or is in an unsupported format
- **Missing info.lua**: Error if the info file is not found (if processing versions)

## Output

The compiler generates:

- **Compiled plugin file** (`.qplug`): Your ready-to-deploy plugin
- **Updated info.lua**: With new version and/or UUID
- **Console output**: Detailed compilation log with:
  - Files processed
  - Versions updated
  - Images encoded (with file sizes)
  - Final output path and file size

## Troubleshooting

**"Main file not found"**
- Verify the file exists and the path is correct
- Use `-m` flag to specify the correct main file name

**"Image file not found"**
- Check the image path is relative to your source directory
- Verify the file exists and the path is spelled correctly

**"Circular include detected"**
- Review your include structure

**Large file sizes**
- Base64 encoding increases file size by ~33%
- Consider compressing images before encoding
- Use SVG for vector graphics when possible

## License

MIT

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
