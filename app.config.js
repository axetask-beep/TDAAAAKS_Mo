// Extends app.json. google-services.json (Firebase → Project settings →
// Android app com.anonymous.axetaskmobile) enables native push; the build
// still works without it, falling back to polling.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  if (fs.existsSync(path.join(__dirname, 'google-services.json'))) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  return config;
};
