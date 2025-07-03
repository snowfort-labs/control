declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

// Global type declarations for Snowfort Desktop

// Snowfort API exposed via preload script
declare global {
  interface Window {
    snowfortAPI: import('./types/ipc').SnowfortAPI;
  }
}

// Node.js process environment
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    ELECTRON_DISABLE_DEVTOOLS?: string;
    SNOWFORT_MCP_MODE?: string;
  }
}

// Export empty object to make this a module
export {};