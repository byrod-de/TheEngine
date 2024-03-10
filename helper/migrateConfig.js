const fs = require('fs');
const yaml = require('yaml');

// Read the JSON configuration file
const jsonFilePath = process.argv[2];
if (!jsonFilePath) {
    console.error('Usage: node migrateConfig config.json');
    process.exit(1);
}

try {
    const jsonData = fs.readFileSync(jsonFilePath, 'utf8');
    const config = JSON.parse(jsonData);

    // Convert JSON to YAML format
    const yamlData = yaml.stringify(config);

    // Write the YAML data to a new file
    const yamlFilePath = jsonFilePath.replace('.json', '.yaml');
    fs.writeFileSync(yamlFilePath, yamlData);

    console.log(`Successfully migrated ${jsonFilePath} to ${yamlFilePath}.`);
} catch (error) {
    console.error('Error migrating config file:', error);
}