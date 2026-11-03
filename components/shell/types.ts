export type ShellUser = {
  handle: string;
  isAdmin: boolean;
  /** The user's active faith this season, if any. */
  faith: { name: string; slug: string } | null;
};
