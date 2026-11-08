# Third-party data in ABOT

## Body and muscle shapes

`src/components/anatomy/bodyPaths.generated.ts` contains SVG path data from
[react-muscle-highlighter](https://github.com/soroojshehryar/react-muscle-highlighter) 1.2.0,
vendored by `scripts/vendor-muscle-paths.py`. Only the path data is used, not the component.

```
MIT License

Copyright (c) 2024 My Muscle Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Exercise data and images

Exercise instructions in `src/data/seed-exercises.generated.ts`, the on-demand catalog, the
exercise images loaded from GitHub, and the list thumbnails in `public/thumbs/` (first frame,
cropped and scaled by `scripts/make-exercise-thumbs.py`) come from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db), released into the public
domain under the Unlicense.
