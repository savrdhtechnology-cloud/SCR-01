export type AppTheme = {
  dark: boolean;
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  primary: string;
  gold: string;
  border: string;
  success: string;
  danger: string;
  warning: string;
};

export const darkTheme: AppTheme = {
  dark: true,
  bg: '#06101f',
  surface: '#0c192b',
  surface2: '#132239',
  text: '#f8fafc',
  muted: '#9aa7b9',
  primary: '#f3bf2f',
  gold: '#f3bf2f',
  border: '#4f4224',
  success: '#2dd4a7',
  danger: '#ff5f72',
  warning: '#f6a723',
};

export const lightTheme: AppTheme = {
  dark: false,
  bg: '#f4f7fb',
  surface: '#ffffff',
  surface2: '#edf3fb',
  text: '#0b1e3b',
  muted: '#65748b',
  primary: '#0c56d8',
  gold: '#d7a51e',
  border: '#d7e1ef',
  success: '#0b9f7a',
  danger: '#dc3545',
  warning: '#d98a00',
};
