import * as esbuild from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';

await esbuild.build({
  entryPoints: ['src/client/wetty.ts'],
  outdir: 'build/client',
  bundle: true,
  platform: 'browser',
  format: 'esm',
  minify: true,
  sourcemap: true,
  loader: {
    '.svg': 'dataurl',
    '.woff2': 'file',
    '.ttf': 'file',
    '.woff': 'file',
    '.eot': 'file',
  },
  plugins: [
    sassPlugin({
      loadPaths: ['node_modules'],
      style: 'compressed',
    }),
  ],
  logLevel: 'info',
});
