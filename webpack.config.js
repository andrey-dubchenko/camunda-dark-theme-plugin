const path = require('path');
const CamundaModelerWebpackPlugin = require('camunda-modeler-webpack-plugin');

module.exports = {
  entry: './client/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'client.js'
    // No libraryTarget — Modeler loads the bundle as a plain script
  },
  plugins: [
    new CamundaModelerWebpackPlugin({ type: 'react' })
  ],
  resolve: {
    extensions: ['.js', '.jsx']
  }
};
