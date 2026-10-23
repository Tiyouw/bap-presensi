const paths = {
  home: <><path d="m3 10 9-7 9 7v10H3Z" /><path d="M9 20v-8h6v8" /></>,
  classes: <><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z" /><path d="M12 5v15" /></>,
  documents: <><path d="M8 3h8l4 4v13H8Z" /><path d="M16 3v5h4M4 7v15h12" /></>,
  accounts: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5" /></>,
  settings: <><path d="M9.33 4.67L10.26 2.15L13.74 2.15L14.67 4.67A7.8 7.8 0 0 1 17.01 6.02L19.66 5.57L21.40 8.58L19.68 10.65A7.8 7.8 0 0 1 19.68 13.35L21.40 15.42L19.66 18.43L17.01 17.98A7.8 7.8 0 0 1 14.67 19.33L13.74 21.85L10.26 21.85L9.33 19.33A7.8 7.8 0 0 1 6.99 17.98L4.34 18.43L2.60 15.42L4.32 13.35A7.8 7.8 0 0 1 4.32 10.65L2.60 8.58L4.34 5.57L6.99 6.02A7.8 7.8 0 0 1 9.33 4.67Z" /><circle cx="12" cy="12" r="3.1" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4M12 17h.01" /></>,
  panel: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 3v18" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
};

export default function WorkspaceIcon({ name }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.panel}
    </svg>
  );
}
