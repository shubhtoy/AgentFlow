// source.config.ts
import { defineDocs, defineConfig } from "fumadocs-mdx/config";
import {
  remarkAdmonition,
  remarkSteps,
  remarkImage,
  remarkNpm,
  remarkMdxMermaid,
  remarkCodeTab,
  remarkGfm,
  rehypeCode,
  rehypeToc
} from "fumadocs-core/mdx-plugins";
var docs = defineDocs({
  dir: "content/docs"
});
var source_config_default = defineConfig({
  mdxOptions: {
    remarkPlugins: [
      remarkGfm,
      remarkAdmonition,
      remarkSteps,
      remarkImage,
      remarkNpm,
      remarkMdxMermaid,
      remarkCodeTab
    ],
    rehypePlugins: [
      rehypeCode,
      rehypeToc
    ]
  }
});
export {
  source_config_default as default,
  docs
};
