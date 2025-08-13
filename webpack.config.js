const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',

  context: path.resolve(__dirname, 'src'),

  entry: {
    'background/service_worker': './runtime/background/service_worker.ts',
    'panel/index':               './runtime/panel/app/index.ts',
    'content/main':              './runtime/content/main.ts',
    'styles/tailwind':           './styles/tailwind.css'
  },

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },

  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@common': path.resolve(__dirname, 'src/common'),
      '@infra': path.resolve(__dirname, 'src/infra'),
      '@panel': path.resolve(__dirname, 'src/runtime/panel'),
      '@content': path.resolve(__dirname, 'src/runtime/content'),
      '@background': path.resolve(__dirname, 'src/runtime/background')
    }
  },

  module: {
    rules: [
      { test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          { loader: 'css-loader', options: { importLoaders: 1 } },
          'postcss-loader'
        ]
      }
    ]
  },

  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: '.' },
        { from: '_locales', to: '_locales' },
        { from: 'assets', to: 'assets' },
        { from: 'runtime/panel/ui/panel.html', to: 'panel/panel.html' },
      ]
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css'
    })
  ],

  devtool: 'inline-source-map'
};
