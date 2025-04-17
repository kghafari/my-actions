const path = require('path');

module.exports = {
  entry: {
    'action-one': './src/action-one/index.ts',
    'action-two': './src/action-two/index.ts',
  },
  output: {
    path: path.resolve(__dirname, 'src'),
    filename: '[name]/index.js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  target: 'node',
  mode: 'production',
};