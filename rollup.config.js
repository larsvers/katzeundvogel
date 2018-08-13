import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import { uglify } from 'rollup-plugin-uglify';

// `npm run build` -> `production` is true
// `npm run dev` -> `production` is false
const production = !process.env.ROLLUP_WATCH;

export default {
  input: 'src/app.js',
  output: {
    file: 'dist/bundle.js',
    format: 'iife', // suitable for <script> tags.
    sourcemap: true
  },
  plugins: [
    babel({
      exclude: 'node_modules/**'
    }),
    resolve(), // tells Rollup how to find dep's in node_modules.
    commonjs(), // converts dep's to ES modules.
    production && uglify() // minify, but only in production.
  ]
};