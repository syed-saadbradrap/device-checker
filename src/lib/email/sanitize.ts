import sanitizeHtml from "sanitize-html";

export { EMAIL_CLIENT_PROFILES } from "@/lib/email/profiles";

/** Strip scripts and dangerous constructs for email HTML preview. */
export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "td",
      "th",
      "col",
      "colgroup",
      "style",
      "center",
      "font",
      "title",
      "meta",
      "link",
      "html",
      "head",
      "body",
    ]),
    allowedAttributes: {
      "*": [
        "class",
        "id",
        "style",
        "align",
        "valign",
        "bgcolor",
        "color",
        "width",
        "height",
        "border",
        "cellpadding",
        "cellspacing",
        "role",
        "aria-*",
        "data-*",
      ],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "border"],
      td: ["colspan", "rowspan", "bgcolor", "background"],
      th: ["colspan", "rowspan"],
      table: ["role", "width", "bgcolor", "background", "align"],
      meta: ["charset", "name", "content", "http-equiv"],
      link: ["rel", "href", "type"],
      font: ["color", "face", "size"],
    },
    allowedSchemes: ["http", "https", "mailto", "cid", "data"],
    allowVulnerableTags: true,
    disallowedTagsMode: "discard",
    allowedScriptDomains: [],
    allowedScriptHostnames: [],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }),
    },
  });
}
