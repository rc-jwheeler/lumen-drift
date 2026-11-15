const URLS: Record<string, string> = {
  sub: "/game/sub.png",
  jelly: "/game/jelly.png",
  fish: "/game/fish.png",
  mine: "/game/mine.png",
  angler: "/game/angler.png",
  squid: "/game/squid.png",
  chest: "/game/chest.png",
  props: "/game/props.png",
  kelp: "/game/kelp.png",
  coral: "/game/coral.png",
};

export type Bank = Record<string, HTMLImageElement>;

export function loadBank(): Promise<Bank> {
  const entries = Object.entries(URLS);
  return Promise.all(
    entries.map(
      ([key, url]) =>
        new Promise<[string, HTMLImageElement]>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve([key, img]);
          img.onerror = () => resolve([key, img]);
          img.src = url;
        }),
    ),
  ).then((pairs) => Object.fromEntries(pairs));
}
