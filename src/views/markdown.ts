"use strict";

import md from "ssb-markdown";
import ssbMessages from "ssb-msgs";
import ssbRef from "ssb-ref";
import { span } from "hyperaxe";

/** @param {{ link: string}[]} mentions */
const toUrl = (mentions) => {
  /** @type {{name: string, link: string}[]} */
  const mentionNames: { name: string, link: string }[] = [];

  /** @param {{ link: string, name: string}} arg */
  const handleLink = ({ name, link }) => {
    if (typeof name === "string") {
      const atName = name.charAt(0) === "@" ? name : `@${name}`;
      mentionNames.push({ name: atName, link });
    }
  };

  ssbMessages.links(mentions, "feed").forEach(handleLink);

  /** @param {string} ref */
  const urlHandler = (ref) => {
    // @mentions
    const found = mentionNames.find(({ name }) => name === ref);
    if (found !== undefined) {
      return `/author/${encodeURIComponent(found.link)}`;
    }

    if (ssbRef.isFeedId(ref)) {
      return `/author/${encodeURIComponent(ref)}`;
    }
    if (ssbRef.isMsgId(ref)) {
      return `/thread/${encodeURIComponent(ref)}`;
    }
    const splitIndex = ref.indexOf("?");
    const blobRef = splitIndex === -1 ? ref : ref.slice(0, splitIndex);
    // const blobParams = splitIndex !== -1 ? ref.slice(splitIndex) : "";

    if (ssbRef.isBlobId(blobRef)) {
      return `/blob/${encodeURIComponent(blobRef)}`;
    }
    if (ref && ref[0] === "#") {
      return `/hashtag/${encodeURIComponent(ref.substr(1))}`;
    }
    return "";
  };

  return urlHandler;
};

/**
 * @param {string} input
 * @param {{name: string, link: string}[]} mentions
 */
export default (input: string, mentions: { name: string, link: string }[] = []) =>
  md.block(input, {
    toUrl: toUrl(mentions),
    /** @param character {string} */
    emoji: (character) => span({ class: "emoji" }, character).outerHTML,
  });
