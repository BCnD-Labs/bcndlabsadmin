# Third-party notices

Blackwall uses or adapts the following open-source work.

## shadcn/ui (MIT)

Components in `src/components/ui/` were generated with the shadcn CLI (`radix-nova` style) and adjusted for the Blackwall theme. Dashboard patterns (chart card, panel layout) follow https://ui.shadcn.com/blocks.

```
MIT License

Copyright (c) 2023 shadcn

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

## satnaing/shadcn-admin (MIT)

The global search command menu (records, navigation, and actions in one palette) and the general admin layout approach were informed by https://github.com/satnaing/shadcn-admin. No files were copied verbatim; the notice is kept because the structure was adapted.

```
MIT License

Copyright (c) 2024 Sat Naing

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

## Fonts (SIL Open Font License 1.1)

Self-hosted through `@fontsource` packages. The license text ships in each package under `node_modules/@fontsource/*/LICENSE`.

- **JetBrains Mono**: Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono).
- **Space Grotesk**: Copyright 2020 The Space Grotesk Project Authors (https://github.com/floriankarsten/space-grotesk).
- **Silkscreen**: Copyright 2001 The Silkscreen Project Authors (https://github.com/googlefonts/silkscreen).

## Runtime dependencies

Installed from npm under their own licenses. Each license is included in its package:
Radix UI (MIT), Lucide (ISC), Recharts (MIT), cmdk (MIT), Sonner (MIT), react-day-picker (MIT), Zustand (MIT), date-fns (MIT), React Router (MIT), React (MIT), Tailwind CSS (MIT), class-variance-authority (Apache-2.0), cn (MIT), tw-animate-css (MIT).
