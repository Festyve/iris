# Source websites

Iris imports the public HTML structure and CSS for the pages below. Each folder contains the adapted upstream markup, style sheets, retained photo or illustration assets, and license. The exact upstream revisions are in [sites.json](sites.json).

| Source | Imported view | Upstream code |
| --- | --- | --- |
| [Business Casual](https://startbootstrap.github.io/startbootstrap-business-casual/) | Café homepage and first menu feature | [Start Bootstrap](https://github.com/StartBootstrap/startbootstrap-business-casual) |
| [Clean Blog](https://startbootstrap.github.io/startbootstrap-clean-blog/) | Masthead and editorial feed | [Start Bootstrap](https://github.com/StartBootstrap/startbootstrap-clean-blog) |
| [Agency](https://startbootstrap.github.io/startbootstrap-agency/) | Studio masthead and services | [Start Bootstrap](https://github.com/StartBootstrap/startbootstrap-agency) |
| [Skeleton](http://getskeleton.com/) | Project homepage, three illustrations and introduction | [Dave Gamache](https://github.com/dhg/Skeleton/tree/gh-pages) |
| [Milligram](https://milligram.io/) | Project homepage and introduction | [Milligram](https://github.com/milligram/milligram.github.io/tree/master) |

The HTML uses neutral copy and omits upstream logos, tracking, forms, scripts and remote fonts. User-facing copy lives in elements marked `data-copy`. The `brand` value identifies site-name slots. Photographs and illustrations use `data-image`. Native Figma uses Inter. The measurements come from a locally rendered copy of the source with a system sans-serif font.

After a source change, run `node scripts/measure-code-sites.mjs` and `npm run build`. Desktop builds measure the HTML again with the current copy. The checked-in measurements also support the server planner. The imported views are static design frames.
