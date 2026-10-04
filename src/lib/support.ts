/** wa.me link that opens a chat with INVTRA support, with a greeting already typed. */
export function supportChatUrl(number: string, text: string) {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
