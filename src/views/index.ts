"use strict";

import path from "path";
import envPaths from "env-paths";
import fs from "fs";
import { message, pub } from "../types/types";
import os from 'os';
import debugRun from "debug";
import highlightJs from "highlight.js";
import prettyMs from "pretty-ms";
import {
  a,
  article,
  br,
  body,
  button,
  details,
  div,
  em,
  footer,
  form,
  h1,
  h2,
  head,
  header,
  hr,
  html,
  img,
  input,
  label,
  li,
  link,
  main,
  meta,
  nav,
  option,
  p,
  pre,
  progress,
  section,
  select,
  span,
  summary,
  textarea,
  title,
  ul,
} from "hyperaxe";

import lodash from "lodash";
import markdown from "./markdown";
import i18nBase from "./i18n";
import getRemoteVersion from "../updater";

const homedir = os.homedir();
const debug = debugRun("oasis");
const gossipPath = path.join(homedir, ".ssb/gossip.json");

let updaterequired = "";
const checkUpdate = getRemoteVersion(async function (checkversion) {
  if (checkversion === "required") {
    return "required";
  }
});

let selectedLanguage = "en";
let i18n = i18nBase[selectedLanguage];

const setLanguage = (language) => {
  selectedLanguage = language;
  i18n = Object.assign({}, i18nBase.en, i18nBase[language]);
};

const markdownUrl = "https://commonmark.org/help/";
const snhUrl = "https://solarnethub.com/";

const doctypeString = "<!DOCTYPE html>";

const THREAD_PREVIEW_LENGTH = 3;

const toAttributes = (obj) =>
  Object.entries(obj)
    .map(([key, val]) => `${key}=${val}`)
    .join(", ");

// non-breaking space
const nbsp = "\xa0";

const template = (titlePrefix, ...elements) => {
  const navLink = ({ href, emoji, text }) =>
    li(
      a(
        { href, class: titlePrefix === text ? "current" : "" },
        span({ class: "emoji" }, emoji),
        nbsp,
        text
      )
    );

  const customCSS = (filename) => {
    const customStyleFile = path.join(
      envPaths("oasis", { suffix: "" }).config,
      filename
    );
    try {
      if (fs.existsSync(customStyleFile)) {
        return link({ rel: "stylesheet", href: filename });
      }
    } catch (error) {
      return "";
    }
  };

  const nodes = html(
    { lang: "en" },
    head(
      title(titlePrefix, " | SNH-Oasis"),
      link({ rel: "stylesheet", href: "/theme.css" }),
      link({ rel: "stylesheet", href: "/assets/style.css" }),
      link({ rel: "stylesheet", href: "/assets/highlight.css" }),
      customCSS("/custom-style.css"),
      link({ rel: "icon", type: "image/svg+xml", href: "/assets/favicon.svg" }),
      meta({ charset: "utf-8" }),
      meta({
        name: "description",
        content: i18n.oasisDescription,
      }),
      meta({
        name: "viewport",
        content: toAttributes({ width: "device-width", "initial-scale": 1 }),
      })
    ),
    body(
      nav(
        ul(
          //navLink({ href: "/imageSearch", emoji: "✧", text: i18n.imageSearch }),
          navLink({ href: "/mentions", emoji: "✺", text: i18n.mentions }),
          navLink({ href: "/public/latest", emoji: "☄", text: i18n.latest }),
          navLink({ href: "/public/latest/summaries", emoji: "※", text: i18n.summaries }),
          navLink({ href: "/public/latest/topics", emoji: "ϟ", text: i18n.topics }),
          navLink({ href: "/public/latest/extended", emoji: "∞", text: i18n.extended }),
          navLink({ href: "/public/popular/day", emoji: "⌘", text: i18n.popular }),
          navLink({ href: "/public/latest/threads", emoji: "♺", text: i18n.threads }),
        )
      ),
      main({ id: "content" }, elements),
      nav(
        ul(
          navLink({ href: "/publish", emoji: "❂", text: i18n.publish }),
          navLink({ href: "/search", emoji: "✦", text: i18n.search }),
          navLink({ href: "/inbox", emoji: "☂", text: i18n.private }),
          navLink({ href: "/profile", emoji: "⚉", text: i18n.profile }),
          navLink({ href: "/invites", emoji: "❄", text: i18n.invites }),
          navLink({ href: "/peers", emoji: "⧖", text: i18n.peers }),
          navLink({ href: "/settings", emoji: "⚙", text: i18n.settings })
        )
      )
    )
  );

  const result = doctypeString + nodes.outerHTML;

  return result;
};

const thread = (messages) => {
  // this first loop is preprocessing to enable auto-expansion of forks when a
  // message in the fork is linked to

  let lookingForTarget = true;
  let shallowest = Infinity;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const depth = lodash.get(msg, "value.meta.thread.depth", 0);

    if (lookingForTarget) {
      const isThreadTarget = Boolean(
        lodash.get(msg, "value.meta.thread.target", false)
      );

      if (isThreadTarget) {
        lookingForTarget = false;
      }
    } else {
      if (depth < shallowest) {
        lodash.set(msg, "value.meta.thread.ancestorOfTarget", true);
        shallowest = depth;
      }
    }
  }

  const msgList: any = [];
  for (let i = 0; i < messages.length; i++) {
    const j = i + 1;

    const currentMsg = messages[i];
    const nextMsg = messages[j];

    const depth = (msg) => {
      // will be undefined when checking depth(nextMsg) when currentMsg is the
      // last message in the thread
      if (msg === undefined) return 0;
      return lodash.get(msg, "value.meta.thread.depth", 0);
    };

    msgList.push(post({ msg: currentMsg }).outerHTML);

    if (depth(currentMsg) < depth(nextMsg)) {
      const isAncestor = Boolean(
        lodash.get(currentMsg, "value.meta.thread.ancestorOfTarget", false)
      );
      const isBlocked = Boolean(nextMsg.value.meta.blocking);
      msgList.push(`<div class="indent"><details ${isAncestor ? "open" : ""}>`);

      const nextAuthor = lodash.get(nextMsg, "value.meta.author.name");
      const nextSnippet = postSnippet(
        lodash.has(nextMsg, "value.content.contentWarning")
          ? lodash.get(nextMsg, "value.content.contentWarning")
          : lodash.get(nextMsg, "value.content.text")
      );
      msgList.push(
        summary(
          isBlocked
            ? i18n.relationshipBlockingPost
            : `${nextAuthor}: ${nextSnippet}`
        ).outerHTML
      );
    } else if (depth(currentMsg) > depth(nextMsg)) {
      // getting more shallow
      const diffDepth = depth(currentMsg) - depth(nextMsg);

      const shallowList: any = [];
      for (let d = 0; d < diffDepth; d++) {
        // on the way up it might go several depths at once
        shallowList.push("</details></div>");
      }

      msgList.push(shallowList);
    }
  }

  const htmlStrings = lodash.flatten(msgList);
  return div(
    {},
    { class: "thread-container", innerHTML: htmlStrings.join("") }
  );
};

const postSnippet = (text) => {
  const max = 40;

  text = text.trim().split("\n", 3).join("\n");
  // this is taken directly from patchwork. i'm not entirely sure what this
  // regex is doing
  text = text.replace(/_|`|\*|#|^\[@.*?]|\[|]|\(\S*?\)/g, "").trim();
  text = text.replace(/:$/, "");
  text = text.trim().split("\n", 1)[0].trim();

  if (text.length > max) {
    text = text.substring(0, max - 1) + "…";
  }

  return text;
};

/**
 * Render a section containing a link that takes users to the context for a
 * thread preview.
 *
 * @param {Array} thread with SSB message objects
 * @param {Boolean} isComment true if this is shown in the context of a comment
 *  instead of a post
 */
const continueThreadComponent = (thread, isComment) => {
  const encoded = {
    next: encodeURIComponent(thread[THREAD_PREVIEW_LENGTH + 1].key),
    parent: encodeURIComponent(thread[0].key),
  };
  const left = thread.length - (THREAD_PREVIEW_LENGTH + 1);
  let continueLink;
  if (isComment == false) {
    continueLink = `/thread/${encoded.parent}#${encoded.next}`;
    return a(
      { href: continueLink },
      i18n.continueReading, ` ${left} `, i18n.moreComments + `${left === 1 ? "" : "s"}`
    );
  } else {
    continueLink = `/thread/${encoded.parent}`;
    return a({ href: continueLink }, i18n.readThread);
  }
};

/**
 * Render an aside with a preview of comments on a message
 *
 * For posts, up to three comments are shown, for comments, up to 3 messages
 * directly following this one in the thread are displayed. If there are more
 * messages in the thread, a link is rendered that links to the rest of the
 * context.
 *
 * @param {Object} post for which to display the aside
 */
const postAside = ({ key, value }) => {
  const thread = value.meta.thread;
  if (thread == null) return null;

  const isComment = value.meta.postType === "comment";

  let postsToShow;
  if (isComment) {
    const commentPosition = thread.findIndex((msg) => msg.key === key);
    postsToShow = thread.slice(
      commentPosition + 1,
      Math.min(commentPosition + (THREAD_PREVIEW_LENGTH + 1), thread.length)
    );
  } else {
    postsToShow = thread.slice(
      1,
      Math.min(thread.length, THREAD_PREVIEW_LENGTH + 1)
    );
  }

  const fragments = postsToShow.map((p) => post({ msg: p }));

  if (thread.length > THREAD_PREVIEW_LENGTH + 1) {
    fragments.push(section(continueThreadComponent(thread, isComment)));
  }

  return div({ class: "indent" }, fragments);
};

const post = ({ msg, aside = false }) => {
  const encoded = {
    key: encodeURIComponent(msg.key),
    author: encodeURIComponent(msg.value.author),
    parent: encodeURIComponent(msg.value.content.root),
  };

  const url = {
    author: `/author/${encoded.author}`,
    likeForm: `/like/${encoded.key}`,
    link: `/thread/${encoded.key}#${encoded.key}`,
    parent: `/thread/${encoded.parent}#${encoded.parent}`,
    avatar: msg.value.meta.author.avatar.url,
    json: `/json/${encoded.key}`,
    subtopic: `/subtopic/${encoded.key}`,
    comment: `/comment/${encoded.key}`,
  };

  const isPrivate = Boolean(msg.value.meta.private);
  const isBlocked = Boolean(msg.value.meta.blocking);
  const isRoot = msg.value.content.root == null;
  const isFork = msg.value.meta.postType === "subtopic";
  const hasContentWarning =
    typeof msg.value.content.contentWarning === "string";
  const isThreadTarget = Boolean(
    lodash.get(msg, "value.meta.thread.target", false)
  );

  const { name } = msg.value.meta.author;

  const ts_received = msg.value.meta.timestamp.received;
  const timeAgo = ts_received.since.replace("~", "");
  const timeAbsolute = ts_received.iso8601.split(".")[0].replace("T", " ");

  const markdownContent = markdown(
    msg.value.content.text,
    msg.value.content.mentions
  );

  const likeButton = msg.value.meta.voted
    ? { value: 0, class: "liked" }
    : { value: 1, class: null };

  const likeCount = msg.value.meta.votes.length;
  const maxLikedNameLength = 16;
  const maxLikedNames = 16;

  const likedByNames = msg.value.meta.votes
    .slice(0, maxLikedNames)
    .map((person) => person.name)
    .map((name) => name.slice(0, maxLikedNameLength))
    .join(", ");

  const additionalLikesMessage =
    likeCount > maxLikedNames ? `+${likeCount - maxLikedNames} more` : ``;

  const likedByMessage =
    likeCount > 0 ? `${likedByNames} ${additionalLikesMessage}` : null;

  const messageClasses = ["post"];

  const recps: any = [];

  const addRecps = (recpsInfo) => {
    recpsInfo.forEach(function (recp) {
      recps.push(
        a(
          { href: `/author/${encodeURIComponent(recp.feedId)}` },
          img({ class: "avatar", src: recp.avatarUrl, alt: "" })
        )
      );
    });
  };

  if (isPrivate) {
    messageClasses.push("private");
    addRecps(msg.value.meta.recpsInfo);
  }

  if (isThreadTarget) {
    messageClasses.push("thread-target");
  }

  const postOptions = {
    post: null,
    comment: i18n.commentDescription({ parentUrl: url.parent }),
    subtopic: i18n.subtopicDescription({ parentUrl: url.parent }),
    mystery: i18n.mysteryDescription,
  };

  const emptyContent = "<p>undefined</p>\n";
  const articleElement =
    markdownContent === emptyContent
      ? article(
        { class: "content" },
        pre({
          innerHTML: highlightJs.highlight(
            JSON.stringify(msg, null, 2),
            { language: "json", ignoreIllegals: true }
          ).value,
        })
      )
      : article({ class: "content", innerHTML: markdownContent });

  if (isBlocked) {
    messageClasses.push("blocked");
    return section(
      {
        id: msg.key,
        class: messageClasses.join(" "),
      },
      i18n.relationshipBlockingPost
    );
  }

  const articleContent = hasContentWarning
    ? details(summary(msg.value.content.contentWarning), articleElement)
    : articleElement;

  const fragment = section(
    {
      id: msg.key,
      class: messageClasses.join(" "),
    },
    header(
      div(
        span(
          { class: "author" },
          a(
            { href: url.author },
            img({ class: "avatar", src: url.avatar, alt: "" }),
            name
          )
        ),
        span({ class: "author-action" }, postOptions[msg.value.meta.postType]),
        span(
          {
            class: "time",
            title: timeAbsolute,
          },
          isPrivate ? "🔒" : null,
          isPrivate ? recps : null,
          a({ href: url.link }, nbsp, timeAgo)
        )
      )
    ),
    articleContent,

    // HACK: centered-footer
    //
    // Here we create an empty div with an anchor tag that can be linked to.
    // In our CSS we ensure that this gets centered on the screen when we
    // link to this anchor tag.
    //
    // This is used for redirecting users after they like a post, when we
    // want the like button that they just clicked to remain close-ish to
    // where it was before they clicked the button.
    div({ id: `centered-footer-${encoded.key}`, class: "centered-footer" }),

    footer(
      div(
        form(
          { action: url.likeForm, method: "post" },
          button(
            {
              name: "voteValue",
              type: "submit",
              value: likeButton.value,
              class: likeButton.class,
              title: likedByMessage,
            },
            `☉ ${likeCount}`
          )
        ),
        a({ href: url.comment }, i18n.comment),
        isPrivate || isRoot || isFork
          ? null
          : a({ href: url.subtopic }, nbsp, i18n.subtopic),
        a({ href: url.json }, nbsp, i18n.json)
      ),
      br()
    )
  );

  const threadSeparator = [div({ class: "text-browser" }, hr(), br())];

  if (aside) {
    return [fragment, postAside(msg), isRoot ? threadSeparator : null];
  } else {
    return fragment;
  }
};

const editProfileView = ({ name, description }) =>
  template(
    i18n.editProfile,
    section(
      h1(i18n.editProfile),
      p(i18n.editProfileDescription),
      form(
        {
          action: "/profile/edit",
          method: "POST",
          enctype: "multipart/form-data",
        },
        label(
          i18n.profileImage,
          input({ type: "file", name: "image", accept: "image/*" })
        ),
        label(i18n.profileName, input({ name: "name", value: name })),
        label(
          i18n.profileDescription,
          textarea(
            {
              autofocus: true,
              name: "description",
            },
            description
          )
        ),
        button(
          {
            type: "submit",
          },
          i18n.submit
        )
      )
    )
  );

/**
 * @param {{avatarUrl: string, description: string, feedId: string, messages: any[], name: string, relationship: object, firstPost: object, lastPost: object}} input
 */
const authorView = ({
  avatarUrl,
  description,
  feedId,
  messages,
  firstPost,
  lastPost,
  name,
  relationship,
}) => {
  const mention = `[@${name}](${feedId})`;
  const markdownMention = highlightJs.highlight(mention, { language: "markdown", ignoreIllegals: true }).value;

  const contactForms: any = [];

  const addForm = ({ action }) =>
    contactForms.push(
      form(
        {
          action: `/${action}/${encodeURIComponent(feedId)}`,
          method: "post",
        },
        button(
          {
            type: "submit",
          },
          i18n[action]
        )
      )
    );

  if (relationship.me === false) {
    if (relationship.following) {
      addForm({ action: "unfollow" });
    } else if (relationship.blocking) {
      addForm({ action: "unblock" });
    } else {
      addForm({ action: "follow" });
      addForm({ action: "block" });
    }
  }

  const relationshipText = (() => {
    if (relationship.me === true) {
      return i18n.relationshipYou;
    } else if (
      relationship.following === true &&
      relationship.blocking === false
    ) {
      return i18n.relationshipFollowing;
    } else if (
      relationship.following === false &&
      relationship.blocking === true
    ) {
      return i18n.relationshipBlocking;
    } else if (
      relationship.following === false &&
      relationship.blocking === false
    ) {
      return i18n.relationshipNone;
    } else if (
      relationship.following === true &&
      relationship.blocking === true
    ) {
      return i18n.relationshipConflict;
    } else {
      throw new Error(`Unknown relationship ${JSON.stringify(relationship)}`);
    }
  })();

  const prefix = section(
    { class: "message" },
    div(
      { class: "profile" },
      img({ class: "avatar", src: avatarUrl }),
      h1(name)
    ),
    pre({
      class: "md-mention",
      innerHTML: markdownMention,
    }),
    description !== "" ? article({ innerHTML: markdown(description) }) : null,
    footer(
      div(
        a({ href: `/likes/${encodeURIComponent(feedId)}` }, i18n.viewLikes),
        span(nbsp, relationshipText),
        ...contactForms,
        relationship.me
          ? a({ href: `/profile/edit` }, nbsp, i18n.editProfile)
          : null
      ),
      br()
    )
  );

  const linkUrl = relationship.me
    ? "/profile/"
    : `/author/${encodeURIComponent(feedId)}/`;

  let items = messages.map((msg) => post({ msg }));
  if (items.length === 0) {
    if (lastPost === undefined) {
      items.push(section(div(span(i18n.feedEmpty))));
    } else {
      items.push(
        section(
          div(
            span(i18n.feedRangeEmpty),
            a({ href: `${linkUrl}` }, i18n.seeFullFeed)
          )
        )
      );
    }
  } else {
    const highestSeqNum = messages[0].value.sequence;
    const lowestSeqNum = messages[messages.length - 1].value.sequence;
    let newerPostsLink;
    if (lastPost !== undefined && highestSeqNum < lastPost.value.sequence)
      newerPostsLink = a(
        { href: `${linkUrl}?gt=${highestSeqNum}` },
        i18n.newerPosts
      );
    else newerPostsLink = span(i18n.newerPosts, { title: i18n.noNewerPosts });
    let olderPostsLink;
    if (lowestSeqNum > firstPost.value.sequence)
      olderPostsLink = a(
        { href: `${linkUrl}?lt=${lowestSeqNum}` },
        i18n.olderPosts
      );
    else
      olderPostsLink = span(i18n.olderPosts, { title: i18n.beginningOfFeed });
    const pagination = section(
      { class: "message" },
      footer(div(newerPostsLink, olderPostsLink), br())
    );
    items.unshift(pagination);
    items.push(pagination);
  }

  return template(i18n.profile, prefix, items);
};

const previewCommentView = async ({
  previewData,
  messages,
  myFeedId,
  parentMessage,
  contentWarning,
}) => {
  const publishAction = `/comment/${encodeURIComponent(messages[0].key)}`;

  const preview = generatePreview({
    previewData,
    contentWarning,
    action: publishAction,
  });
  return commentView(
    { messages, myFeedId, parentMessage },
    preview,
    previewData.text,
    contentWarning
  );
};

const commentView = async (
  { messages, myFeedId, parentMessage },
  preview?,
  text?,
  contentWarning?
) => {
  let markdownMention;

  const messageElements = await Promise.all(
    messages.reverse().map((message) => {
      debug("%O", message);
      const authorName = message.value.meta.author.name;
      const authorFeedId = message.value.author;
      if (authorFeedId !== myFeedId) {
        if (message.key === parentMessage.key) {
          const x = `[@${authorName}](${authorFeedId})\n\n`;
          markdownMention = x;
        }
      }
      return post({ msg: message });
    })
  );

  const action = `/comment/preview/${encodeURIComponent(messages[0].key)}`;
  const method = "post";

  const isPrivate = parentMessage.value.meta.private;
  const authorName = parentMessage.value.meta.author.name;

  const publicOrPrivate = isPrivate ? i18n.commentPrivate : i18n.commentPublic;
  const maybeSubtopicText = isPrivate ? [null] : i18n.commentWarning;

  return template(
    i18n.commentTitle({ authorName }),
    div({ class: "thread-container" }, messageElements),
    preview !== undefined ? preview : "",
    p(
      ...i18n.commentLabel({ publicOrPrivate, markdownUrl }),
      ...maybeSubtopicText
    ),
    form(
      { action, method, enctype: "multipart/form-data" },
      label(
        i18n.contentWarningLabel,
        input({
          name: "contentWarning",
          type: "text",
          class: "contentWarning",
          value: contentWarning ? contentWarning : "",
          placeholder: i18n.contentWarningPlaceholder,
        })
      ),
      textarea(
        {
          autofocus: true,
          required: true,
          name: "text",
        },
        text ? text : isPrivate ? null : markdownMention
      ),
      button({ type: "submit" }, i18n.preview),
      label({ class: "file-button", for: "blob" }, i18n.attachFiles),
      input({ type: "file", id: "blob", name: "blob" })
    )
  );
};

const mentionsView = ({ messages }) => {
  return messageListView({
    messages,
    viewTitle: i18n.mentions,
    viewDescription: i18n.mentionsDescription,
  });
};

const privateView = ({ messages }) => {
  return messageListView({
    messages,
    viewTitle: i18n.private,
    viewDescription: i18n.privateDescription,
  });
};

const publishCustomView = async () => {
  const action = "/publish/custom";
  const method = "post";

  return template(
    i18n.publishCustom,
    section(
      h1(i18n.publishCustom),
      p(i18n.publishCustomDescription),
      form(
        { action, method },
        textarea(
          {
            autofocus: true,
            required: true,
            name: "text",
          },
          "{\n",
          '  "type": "test",\n',
          '  "hello": "world"\n',
          "}"
        ),
        button(
          {
            type: "submit",
          },
          i18n.submit
        )
      )
    ),
    p(i18n.publishBasicInfo({ href: "/publish" }))
  );
};

const threadView = ({ messages }) => {
  const rootMessage = messages[0];
  const rootAuthorName = rootMessage.value.meta.author.name;
  const rootSnippet = postSnippet(
    lodash.get(rootMessage, "value.content.text", i18n.mysteryDescription)
  );
  return template([`@${rootAuthorName}: `, rootSnippet], thread(messages));
};

const publishView = (preview?, text?, contentWarning?) => {
  return template(
    i18n.publish,
    section(
      h1(i18n.publish),
      form(
        {
          action: "/publish/preview",
          method: "post",
          enctype: "multipart/form-data",
        },
        label(
          i18n.publishLabel({ markdownUrl, linkTarget: "_blank" }),
          label(
            i18n.contentWarningLabel,
            input({
              name: "contentWarning",
              type: "text",
              class: "contentWarning",
              value: contentWarning ? contentWarning : "",
              placeholder: i18n.contentWarningPlaceholder,
            })
          ),
          textarea({ required: true, name: "text", placeholder: i18n.publishWarningPlaceholder }, text ? text : "")
        ),
        button({ type: "submit" }, i18n.preview),
        label({ class: "file-button", for: "blob" }, i18n.attachFiles),
        input({ type: "file", id: "blob", name: "blob" })
      )
    ),
    preview ? preview : "",
    p(i18n.publishCustomInfo({ href: "/publish/custom" }))
  );
};

const generatePreview = ({ previewData, contentWarning, action }) => {
  const { authorMeta, text, mentions } = previewData;
  const msg: message = {
    key: "%non-existent.preview",
    value: {
      author: authorMeta.id,
      // sequence: -1,
      content: {
        type: "post",
        text: text,
      },
      timestamp: Date.now(),
      meta: {
        isPrivate: true,
        votes: [],
        author: {
          name: authorMeta.name,
          avatar: {
            url: `/image/64/${encodeURIComponent(authorMeta.image)}`,
          },
        },
      },
    },
  };
  if (contentWarning) msg.value.content.contentWarning = contentWarning;
  const ts = new Date(msg.value.timestamp);
  lodash.set(msg, "value.meta.timestamp.received.iso8601", ts.toISOString());
  const ago = Date.now() - Number(ts);
  const prettyAgo = prettyMs(ago, { compact: true });
  lodash.set(msg, "value.meta.timestamp.received.since", prettyAgo);
  return div(
    Object.keys(mentions).length === 0
      ? ""
      : section(
        { class: "mention-suggestions" },
        h2(i18n.mentionsMatching),
        Object.keys(mentions).map((name) => {
          let matches = mentions[name];

          return div(
            matches.map((m) => {
              let relationship = { emoji: "", desc: "" };
              if (m.rel.followsMe && m.rel.following) {
                relationship.emoji = "☍";
                relationship.desc = i18n.relationshipMutuals;
              } else if (m.rel.following) {
                relationship.emoji = "☌";
                relationship.desc = i18n.relationshipFollowing;
              } else if (m.rel.followsMe) {
                relationship.emoji = "⚼";
                relationship.desc = i18n.relationshipTheyFollow;
              } else {
                if (m.rel.me = true) {
                  relationship.emoji = "#";
                  relationship.desc = i18n.relationshipYou;
                } else {
                  relationship.emoji = "❓";
                  relationship.desc = i18n.relationshipNotFollowing;
                }
              }
              return div(
                { class: "mentions-container" },
                a(
                  {
                    class: "mentions-image",
                    href: `/author/${encodeURIComponent(m.feed)}`,
                  },
                  img({ src: `/image/64/${encodeURIComponent(m.img)}` })
                ),
                a(
                  {
                    class: "mentions-name",
                    href: `/author/${encodeURIComponent(m.feed)}`,
                  },
                  m.name
                ),
                div(
                  { class: "emo-rel" },
                  span(
                    { class: "emoji", title: relationship.desc },
                    relationship.emoji
                  ),
                  span(
                    { class: "mentions-listing" },
                    `[@${m.name}](${m.feed})`
                  )
                )
              );
            })
          );
        })
      ),
    section(
      { class: "post-preview" },
      post({ msg }),

      // doesn't need blobs, preview adds them to the text
      form(
        { action, method: "post" },
        input({
          name: "contentWarning",
          type: "hidden",
          value: contentWarning,
        }),
        input({
          name: "text",
          type: "hidden",
          value: text,
        }),
        button({ type: "submit" }, i18n.publish)
      )
    )
  );
};

const previewView = ({ previewData, contentWarning }) => {
  const publishAction = "/publish";

  const preview = generatePreview({
    previewData,
    contentWarning,
    action: publishAction,
  });
  return publishView(preview, previewData.text, contentWarning);
};

const peersView = async ({ peers, supports, blocks, recommends }) => {

  const startButton = form(
    { action: "/settings/conn/start", method: "post" },
    button({ type: "submit" }, i18n.startNetworking)
  );

  const restartButton = form(
    { action: "/settings/conn/restart", method: "post" },
    button({ type: "submit" }, i18n.restartNetworking)
  );

  const stopButton = form(
    { action: "/settings/conn/stop", method: "post" },
    button({ type: "submit" }, i18n.stopNetworking)
  );

  const syncButton = form(
    { action: "/settings/conn/sync", method: "post" },
    button({ type: "submit" }, i18n.sync)
  );

  const connButtons = div({ class: "form-button-group" }, [
    startButton,
    restartButton,
    stopButton,
    syncButton,
  ]);

  const peerList = (peers || [])
    .filter(([, data]) => data.state === "connected")
    .map(([, data]) => {
      return li(
        data.name, br,
        a(
          { href: `/author/${encodeURIComponent(data.key)}` },
          data.key, br, br
        )
      );
    });

  return template(
    i18n.peers,
    section(
      { class: "message" },
      h1(i18n.peerConnections),
      connButtons,
      h1(i18n.online, " (", peerList.length, ")"),
      peerList.length > 0 ? ul(peerList) : i18n.noConnections,
      p(i18n.connectionActionIntro),
      h1(i18n.supported, " (", supports.length / 2, ")"),
      supports.length > 0 ? ul(supports) : i18n.noSupportedConnections,
      p(i18n.connectionActionIntro),
      h1(i18n.recommended, " (", recommends.length / 2, ")"),
      recommends.length > 0 ? ul(recommends) : i18n.noRecommendedConnections,
      p(i18n.connectionActionIntro),
      h1(i18n.blocked, " (", blocks.length / 2, ")"),
      blocks.length > 0 ? ul(blocks) : i18n.noBlockedConnections,
      p(i18n.connectionActionIntro),
    )
  );
};

const invitesView = () => {
  let pubs: string | undefined = undefined;
  try {
    pubs = fs.readFileSync(gossipPath, "utf8");
  } catch {
    //keep it undefined
  }
  if (pubs == undefined) {
    var pubsValue = "false";
  } else {
    var keys = Object.keys(pubs);
    if (keys[0] === undefined) {
      var pubsValue = "false";
    } else {
      var pubsValue = "true";
    }
  }
  let pub = [];
  if (pubsValue === "true" && typeof pubs === "string") {
    let jpubs: pub[] = JSON.parse(pubs);
    const arr2: any = [];
    for (var i = 0; i < jpubs.length; i++) {
      arr2.push(
        li("PUB: " + jpubs[i].host, br,
          i18n.inhabitants + ": " + jpubs[i].announcers, br,
          a(
            { href: `/author/${encodeURIComponent(jpubs[i].key)}` },
            jpubs[i].key
          ), br, br
        )
      );
    }
    pub = arr2;
  }

  return template(
    i18n.invites,
    section(
      { class: "message" },
      h1(i18n.invites),
      p(i18n.invitesDescription),
      form(
        { action: "/settings/invite/accept", method: "post" },
        input({ name: "invite", type: "text", autofocus: true, required: true }),
        button({ type: "submit" }, i18n.acceptInvite),
        h1(i18n.acceptedInvites, " (", pub.length, ")"),
        pub.length > 0 ? ul(pub) : i18n.noInvites,
      ),
    )
  );
};

const settingsView = ({ theme, themeNames, version }) => {
  const themeElements = themeNames.map((cur) => {
    const isCurrentTheme = cur === theme;
    if (isCurrentTheme) {
      return option({ value: cur, selected: true }, cur);
    } else {
      return option({ value: cur }, cur);
    }
  });

  const base16 = [
    // '00', removed because this is the background
    "01",
    "02",
    "03",
    "04",
    "05",
    "06",
    "07",
    "08",
    "09",
    "0A",
    "0B",
    "0C",
    "0D",
    "0E",
    "0F",
  ];

  const base16Elements = base16.map((base) =>
    div({
      class: `theme-preview theme-preview-${base}`,
    })
  );

  const languageOption = (longName, shortName) =>
    shortName === selectedLanguage
      ? option({ value: shortName, selected: true }, longName)
      : option({ value: shortName }, longName);

  const rebuildButton = form(
    { action: "/settings/rebuild", method: "post" },
    button({ type: "submit" }, i18n.rebuildName)
  );

  if (checkUpdate === "required") {
    updaterequired = form(
      { action: "/update", method: "post" },
      button({ type: "submit" }, i18n.updateit)
    );
  };

  return template(
    i18n.settings,
    section(
      { class: "message" },
      h1(i18n.settings),
      p(a({ href: snhUrl, target: "_blank" }, i18n.settingsIntro({ version }))),
      p(updaterequired),
      h2(i18n.theme),
      p(i18n.themeIntro),
      form(
        { action: "/theme.css", method: "post" },
        select({ name: "theme" }, ...themeElements),
        button({ type: "submit" }, i18n.setTheme)
      ),
      h2(i18n.language),
      p(i18n.languageDescription),
      form(
        { action: "/language", method: "post" },
        select({ name: "language" }, [
          // Languages are sorted alphabetically by their 'long name'.
          /* spell-checker:disable */
          languageOption("English", "en"),
          languageOption("Español", "es"),
          /* spell-checker:enable */
        ]),
        button({ type: "submit" }, i18n.setLanguage)
      ),
      h2(i18n.indexes),
      p(i18n.indexesDescription),
      rebuildButton,
    )
  );
};

/** @param {{ viewTitle: string, viewDescription: string }} input */
const viewInfoBox = ({ viewTitle = null, viewDescription = null }) => {
  if (!viewTitle && !viewDescription) {
    return null;
  }
  return section(
    { class: "viewInfo" },
    viewTitle ? h1(viewTitle) : null,
    viewDescription ? em(viewDescription) : null
  );
};

const likesView = async ({ messages, feed, name }) => {
  const authorLink = a(
    { href: `/author/${encodeURIComponent(feed)}` },
    "@" + name
  );

  return template(
    ["@", name, i18n.likedBy],
    viewInfoBox({
      viewTitle: span(authorLink, i18n.likedBy),
      viewDescription: span(i18n.spreadedDescription)
    }),
    messages.map((msg) => post({ msg }))
  );
};

const messageListView = ({
  messages,
  viewTitle = null,
  viewDescription = null,
  viewElements = null,
  // If `aside = true`, it will show a few comments in the thread.
  aside = false,
}) => {
  return template(
    viewTitle,
    section(h1(viewTitle), p(viewDescription), viewElements),
    messages.map((msg) => post({ msg, aside }))
  );
};

const popularView = ({ messages, prefix }) => {
  return messageListView({
    messages,
    viewElements: prefix,
    viewTitle: i18n.popular,
    viewDescription: i18n.popularDescription,
  });
};

const extendedView = ({ messages }) => {
  return messageListView({
    messages,
    viewTitle: i18n.extended,
    viewDescription: i18n.extendedDescription,
  });
};

const latestView = ({ messages }) => {
  return messageListView({
    messages,
    viewTitle: i18n.latest,
    viewDescription: i18n.latestDescription,
  });
};

const topicsView = ({ messages, prefix }) => {
  return messageListView({
    messages,
    viewTitle: i18n.topics,
    viewDescription: i18n.topicsDescription,
    viewElements: prefix,
  });
};

const summaryView = ({ messages }) => {
  return messageListView({
    messages,
    viewTitle: i18n.summaries,
    viewDescription: i18n.summariesDescription,
    aside: true,
  });
};

const spreadedView = ({ messages }) => {
  return messageListView({//TODO: this may look weird, was formerly asking for 'spreadedListView'
    messages,
    viewTitle: i18n.spreaded,
    viewDescription: i18n.spreadedDescription,
  });
};

const threadsView = ({ messages }) => {
  return messageListView({
    messages,
    viewTitle: i18n.threads,
    viewDescription: i18n.threadsDescription,
    aside: true,
  });
};

const previewSubtopicView = async ({
  previewData,
  messages,
  myFeedId,
  contentWarning,
}) => {
  const publishAction = `/subtopic/${encodeURIComponent(messages[0].key)}`;

  const preview = generatePreview({
    previewData,
    contentWarning,
    action: publishAction,
  });
  return subtopicView(
    { messages, myFeedId },
    preview,
    previewData.text,
    contentWarning
  );
};

const subtopicView = async (
  { messages, myFeedId },
  preview?,
  text?,
  contentWarning?
) => {
  const subtopicForm = `/subtopic/preview/${encodeURIComponent(
    messages[messages.length - 1].key
  )}`;

  let markdownMention;

  const messageElements = await Promise.all(
    messages.reverse().map((message) => {
      debug("%O", message);
      const authorName = message.value.meta.author.name;
      const authorFeedId = message.value.author;
      if (authorFeedId !== myFeedId) {
        if (message.key === messages[0].key) {
          const x = `[@${authorName}](${authorFeedId})\n\n`;
          markdownMention = x;
        }
      }
      return post({ msg: message });
    })
  );

  const authorName = messages[messages.length - 1].value.meta.author.name;

  return template(
    i18n.subtopicTitle({ authorName }),
    div({ class: "thread-container" }, messageElements),
    preview !== undefined ? preview : "",
    p(i18n.subtopicLabel({ markdownUrl })),
    form(
      { action: subtopicForm, method: "post", enctype: "multipart/form-data" },
      textarea(
        {
          autofocus: true,
          required: true,
          name: "text",
        },
        text ? text : markdownMention
      ),
      label(
        i18n.contentWarningLabel,
        input({
          name: "contentWarning",
          type: "text",
          class: "contentWarning",
          value: contentWarning ? contentWarning : "",
          placeholder: i18n.contentWarningPlaceholder,
        })
      ),
      button({ type: "submit" }, i18n.preview),
      label({ class: "file-button", for: "blob" }, i18n.attachFiles),
      input({ type: "file", id: "blob", name: "blob" })
    )
  );
};

const searchView = ({ messages, query }) => {
  const searchInput = input({
    name: "query",
    required: false,
    type: "search",
    value: query,
  });

  // - Minimum length of 3 because otherwise SSB-Search hangs forever. :)
  //   https://github.com/ssbc/ssb-search/issues/8
  // - Using `setAttribute()` because HyperScript (the HyperAxe dependency has
  //   a bug where the `minlength` property is being ignored. No idea why.
  //   https://github.com/hyperhype/hyperscript/issues/91
  searchInput.setAttribute("minlength", 3);

  return template(
    i18n.search,
    section(
      h1(i18n.search),
      form(
        { action: "/search", method: "get" },
        label(i18n.searchLabel, searchInput),
        button(
          {
            type: "submit",
          },
          i18n.submit
        )
      )
    ),
    messages.map((msg) => post({ msg }))
  );
};

const imageResult = ({ id, infos }) => {
  const encodedBlobId = encodeURIComponent(id);
  // only rendering the first message result so far
  // todo: render links to the others as well
  const info = infos[0];
  const encodedMsgId = encodeURIComponent(info.msg);

  return div(
    {
      class: "image-result",
    },
    [
      a(
        {
          href: `/blob/${encodedBlobId}`,
        },
        img({ src: `/image/256/${encodedBlobId}` })
      ),
      a(
        {
          href: `/thread/${encodedMsgId}#${encodedMsgId}`,
          class: "result-text",
        },
        info.name
      ),
    ]
  );
};

const imageSearchView = ({ blobs, query }) => {
  const searchInput = input({
    name: "query",
    required: false,
    type: "search",
    value: query,
  });

  // - Minimum length of 3 because otherwise SSB-Search hangs forever. :)
  //   https://github.com/ssbc/ssb-search/issues/8
  // - Using `setAttribute()` because HyperScript (the HyperAxe dependency has
  //   a bug where the `minlength` property is being ignored. No idea why.
  //   https://github.com/hyperhype/hyperscript/issues/91
  searchInput.setAttribute("minlength", 3);

  return template(
    i18n.imageSearch,
    section(
      h1(i18n.imageSearch),
      form(
        { action: "/imageSearch", method: "get" },
        label(i18n.imageSearchLabel, searchInput),
        button(
          {
            type: "submit",
          },
          i18n.submit
        )
      )
    ),
    div(
      {
        class: "image-search-grid",
      },
      Object.keys(blobs)
        // todo: add pagination
        .slice(0, 30)
        .map((blobId) => imageResult({ id: blobId, infos: blobs[blobId] }))
    )
  );
};

const hashtagView = ({ messages, hashtag }) => {
  return template(
    `#${hashtag}`,
    section(h1(`#${hashtag}`), p(i18n.hashtagDescription)),
    messages.map((msg) => post({ msg }))
  );
};

/** @param {{percent: number}} input */
const indexingView = ({ percent }) => {
  // TODO: i18n
  const message = `Oasis has only processed ${percent}% of the messages and needs to catch up. This page will refresh every 10 seconds. Thanks for your patience! ❤`;

  const nodes = html(
    { lang: "en" },
    head(
      title("Oasis"),
      link({ rel: "icon", type: "image/svg+xml", href: "/assets/favicon.svg" }),
      meta({ charset: "utf-8" }),
      meta({
        name: "description",
        content: i18n.oasisDescription,
      }),
      meta({
        name: "viewport",
        content: toAttributes({ width: "device-width", "initial-scale": 1 }),
      }),
      meta({ "http-equiv": "refresh", content: 10 })
    ),
    body(
      main(
        { id: "content" },
        p(message),
        progress({ value: percent, max: 100 })
      )
    )
  );

  const result = doctypeString + nodes.outerHTML;

  return result;
};


export default {
  authorView,
  previewCommentView,
  commentView,
  editProfileView,
  indexingView,
  extendedView,
  latestView,
  likesView,
  threadView,
  hashtagView,
  mentionsView,
  popularView,
  previewView,
  privateView,
  publishCustomView,
  publishView,
  previewSubtopicView,
  subtopicView,
  searchView,
  imageSearchView,
  setLanguage,
  settingsView,
  peersView,
  invitesView,
  topicsView,
  summaryView,
  threadsView,
  spreadedView,
}