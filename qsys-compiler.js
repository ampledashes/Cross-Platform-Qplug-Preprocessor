#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class QSysPluginCompiler {
    constructor() {
        this.includePattern = /--\[\[\s*#include\s+"([^"]+)"\s*\]\]/g;
        this.encodePattern = /--\[\[\s*#encode\s+"([^"]+)"\s*\]\]/g;
        this.buildVersionPattern = /BuildVersion\s*=\s*"([^"]+)"/;
        this.idPattern = /Id\s*=\s*"([^"]+)"/;
        this.supportedImageExtensions = ['.png', '.jpg', '.jpeg', '.svg'];
    }

    /**
     * Generate a new UUID for the plugin
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Parse version string and return version components
     */
    parseVersion(versionStr) {
        const parts = versionStr.split('.').map(num => parseInt(num, 10) || 0);
        while (parts.length < 4) parts.push(0);
        return parts;
    }

    /**
     * Format version array back to string
     */
    formatVersion(versionArray) {
        return versionArray.join('.');
    }

    /**
     * Increment version based on build argument
     */
    incrementVersion(currentVersion, buildType) {
        const version = this.parseVersion(currentVersion);
        
        switch (buildType) {
            case 'ver_maj':
                version[0]++;
                version[1] = version[2] = version[3] = 0;
                break;
            case 'ver_min':
                version[1]++;
                version[2] = version[3] = 0;
                break;
            case 'ver_fix':
                version[2]++;
                version[3] = 0;
                break;
            case 'ver_dev':
            default:
                version[3]++;
                break;
        }
        
        return this.formatVersion(version);
    }

    /**
     * Encode image file to base64
     */
    encodeImage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        
        if (!this.supportedImageExtensions.includes(ext)) {
            throw new Error(`Unsupported image format: ${ext}. Supported formats: ${this.supportedImageExtensions.join(', ')}`);
        }

        const imageBuffer = fs.readFileSync(filePath);
        const base64String = imageBuffer.toString('base64');
        
        // For SVG files, we return just the base64 string
        if (ext === '.svg') {
            return base64String;
        }
        
        // For other image formats, we need to include the data URI prefix
        let mimeType;
        switch (ext) {
            case '.png':
                mimeType = 'image/png';
                break;
            case '.jpg':
            case '.jpeg':
                mimeType = 'image/jpeg';
                break;
        }
        
        return base64String;
    }

    /**
     * Process encode directives in the content
     */
    processEncodes(content, basePath) {
        return content.replace(this.encodePattern, (match, filename) => {
            const filePath = path.resolve(basePath, filename);
            
            try {
                if (!fs.existsSync(filePath)) {
                    console.warn(`Warning: Image file not found: ${filename}`);
                    return `"-- Image not found: ${filename}"`;
                }
                
                const encodedImage = this.encodeImage(filePath);
                console.log(`Encoded image: ${filename} (${(fs.statSync(filePath).size / 1024).toFixed(2)} KB)`);
                
                return `"${encodedImage}"`;
                
            } catch (error) {
                console.error(`Error encoding image ${filename}:`, error.message);
                return `"-- Error encoding: ${filename}"`;
            }
        });
    }

    /**
     * Process include directives in the content
     */
    processIncludes(content, basePath, processedFiles = new Set()) {
        return content.replace(this.includePattern, (match, filename) => {
            const filePath = path.resolve(basePath, filename);
            
            // Prevent circular includes
            if (processedFiles.has(filePath)) {
                console.warn(`Warning: Circular include detected for ${filename}`);
                return `-- Circular include: ${filename}`;
            }
            
            try {
                if (!fs.existsSync(filePath)) {
                    console.warn(`Warning: Include file not found: ${filename}`);
                    return `-- File not found: ${filename}`;
                }
                
                const includeContent = fs.readFileSync(filePath, 'utf8');
                processedFiles.add(filePath);
                
                // Process both includes and encodes in the included file
                let processedContent = this.processIncludes(includeContent, basePath, new Set(processedFiles));
                processedContent = this.processEncodes(processedContent, basePath);
                
                return `-- Begin include: ${filename}\n${processedContent}\n-- End include: ${filename}`;
                
            } catch (error) {
                console.error(`Error reading include file ${filename}:`, error.message);
                return `-- Error including: ${filename}`;
            }
        });
    }

    /**
     * Update plugin info with new version and UUID if needed
     */
    updatePluginInfo(infoPath, buildType) {
        if (!fs.existsSync(infoPath)) {
            console.error('Error: info.lua file not found');
            return null;
        }

        let content = fs.readFileSync(infoPath, 'utf8');
        let modified = false;

        // Generate UUID if placeholder exists
        if (content.includes('<guid>')) {
            const newUUID = this.generateUUID();
            content = content.replace('<guid>', newUUID);
            console.log(`Generated new UUID: ${newUUID}`);
            modified = true;
        }

        // Update BuildVersion
        const versionMatch = content.match(this.buildVersionPattern);
        if (versionMatch) {
            const currentVersion = versionMatch[1];
            const newVersion = this.incrementVersion(currentVersion, buildType);
            content = content.replace(this.buildVersionPattern, `BuildVersion = "${newVersion}"`);
            console.log(`Updated BuildVersion: ${currentVersion} -> ${newVersion}`);
            modified = true;
        }

        // Write back if modified
        if (modified) {
            fs.writeFileSync(infoPath, content);
        }

        return content;
    }

    /**
     * Compile the plugin
     */
    compile(options = {}) {
        const {
            sourceDir = '.',
            mainFile = 'plugin.lua',
            outputFile = null,
            buildType = 'ver_dev',
            infoFile = 'info.lua'
        } = options;

        const sourcePath = path.resolve(sourceDir);
        const mainFilePath = path.resolve(sourcePath, mainFile);
        const infoFilePath = path.resolve(sourcePath, infoFile);

        console.log('Q-Sys Plugin Compiler');
        console.log('====================');
        console.log(`Source directory: ${sourcePath}`);
        console.log(`Main file: ${mainFile}`);
        console.log(`Build type: ${buildType}`);

        // Check if main file exists
        if (!fs.existsSync(mainFilePath)) {
            console.error(`Error: Main file ${mainFile} not found in ${sourcePath}`);
            process.exit(1);
        }

        // Update plugin info
        this.updatePluginInfo(infoFilePath, buildType);

        // Read and process the main file
        console.log('\nProcessing includes and image encodings...');
        let content = fs.readFileSync(mainFilePath, 'utf8');
        
        // Process includes first (which may contain encode directives)
        content = this.processIncludes(content, sourcePath);
        
        // Then process any remaining encode directives
        content = this.processEncodes(content, sourcePath);

        // Determine output filename
        let outputFileName = outputFile;
        if (!outputFileName) {
            const pluginName = path.basename(sourcePath);
            outputFileName = `${pluginName}.qplug`;
        }
        
        const outputPath = path.resolve(sourcePath, outputFileName);

        // Write the compiled plugin
        fs.writeFileSync(outputPath, content);
        
        console.log(`\nCompilation successful!`);
        console.log(`Output: ${outputPath}`);
        
        // Show file size
        const stats = fs.statSync(outputPath);
        console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);

        return outputPath;
    }
}

/**
 * Command line interface
 */
function main() {
    const args = process.argv.slice(2);
    
    // Parse command line arguments
    const options = {
        sourceDir: '.',
        mainFile: 'plugin.lua',
        outputFile: null,
        buildType: 'ver_dev',
        infoFile: 'info.lua'
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--source':
            case '-s':
                options.sourceDir = args[++i];
                break;
            case '--main':
            case '-m':
                options.mainFile = args[++i];
                break;
            case '--output':
            case '-o':
                options.outputFile = args[++i];
                break;
            case '--info':
            case '-i':
                options.infoFile = args[++i];
                break;
            case '--build-type':
            case '-b':
                options.buildType = args[++i];
                break;
            case '--help':
            case '-h':
                console.log(`
Q-Sys Plugin Compiler

Usage: node qsys-compiler.js [options]

Options:
  -s, --source <dir>        Source directory (default: current directory)
  -m, --main <file>         Main plugin file (default: plugin.lua)
  -o, --output <file>       Output file name (default: auto-generated)
  -i, --info <file>         Info file name (default: info.lua)
  -b, --build-type <type>   Build type: ver_maj, ver_min, ver_fix, ver_dev (default: ver_dev)
  -h, --help               Show this help message

Build Types:
  ver_maj    Increment major version (x.0.0.0)
  ver_min    Increment minor version (x.y.0.0)
  ver_fix    Increment fix version (x.y.z.0)
  ver_dev    Increment dev version (x.y.z.w) [default]

Features:
  File Inclusion:
    --[[ #include "filename.lua" ]]    Include Lua files
    
  Image Encoding:
    --[[ #encode "image.png" ]]        Encode PNG/JPG/JPEG to base64 data URI
    --[[ #encode "image.svg" ]]        Encode SVG to base64 string
    
    Supported formats: .png, .jpg, .jpeg, .svg
    Images can be in subfolders (use relative paths)

Examples:
  node qsys-compiler.js
  node qsys-compiler.js --build-type ver_min
  node qsys-compiler.js --source ./my-plugin --output MyPlugin.qplug
  
  Example usage in Lua code:
    Logo = "--[[ #encode "logo.png" ]]"
    table.insert(graphics, {
      Type="Image",
      Image=Logo,
      Position={0,0},
      Size={75,9}
    })
    
    -- For SVG files:
    table.insert(graphics, {
      Type="svg",
      Image="--[[ #encode "logo.svg" ]]",
      Position={0,0},
      Size={75,9}
    })
                `);
                process.exit(0);
            default:
                // Check if it's a build type without --build-type flag
                if (['ver_maj', 'ver_min', 'ver_fix', 'ver_dev'].includes(arg)) {
                    options.buildType = arg;
                } else {
                    console.warn(`Unknown argument: ${arg}`);
                }
        }
    }

    try {
        const compiler = new QSysPluginCompiler();
        compiler.compile(options);
    } catch (error) {
        console.error('Compilation failed:', error.message);
        process.exit(1);
    }
}

// Export for use as module or run as CLI
if (require.main === module) {
    main();
} else {
    module.exports = QSysPluginCompiler;
}
