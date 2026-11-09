# Warm A/B typography

Self-hosted subsets derived from Google Fonts **Noto Sans TC**, SIL Open Font License 1.1. See `LICENSE-Noto-TC.txt`.

Source: https://github.com/google/fonts/tree/main/ofl/notosanstc
Source file: `NotoSansTC[wght].ttf`
SHA-256: `864727d210d54f2537bbe23b3a839436c3992af72de9322af5270897246bd44f`

Renamed families: Rental Warm TC (400/700), Rental Warm Display (800). The display subset covers the two page headings and the large numeric amount; body subsets include Latin, punctuation, full-width forms and basic CJK ideographs. Other characters use the explicit system fallback.

The prepared WOFF2 files are committed. Normal builds do not install or download fonts. Optional regeneration:

```sh
python3 scripts/build-warm-fonts.py --source /path/to/NotoSansTC.ttf
```

Requires fontTools and Brotli in the caller's Python environment. The body weights are shared across workspace pages and both themes. The display subset remains limited to the warm overview and rooms headings and large amount. No text or names are sent to a third-party font server.
