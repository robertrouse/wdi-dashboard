/* The Action octopus pictogram, traced from the brand book (p.14, "The
   Pictogram"). Vector art lifted straight out of the PDF's own path data
   rather than redrawn, so the curves are the real ones.

   Stroke follows `currentColor`, so the mark takes the colour of whatever it
   sits in. The two eyes are filled rather than open because on the original
   they mask the tentacle lines running behind them; `eyeFill` should be the
   background the mark is placed on. */
export default function ActionMark({ size = 30, eyeFill = "var(--blue-raven)", title }) {
  return (
    <svg width={size} height={Math.round(size * 0.8009)} viewBox="0 0 409.5 327.9"
         fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"
         role={title ? "img" : undefined} aria-hidden={title ? undefined : true}
         style={{ flexShrink: 0, overflow: "visible" }}>
      {title && <title>{title}</title>}
      <path d="M204.41 199.7C163.45 226.51 91.37 302.89 135.48 319.74C146.48 323.94 158.75 323.58 169.36 318.46C173.18 316.61 175.47 314.8 173.4 313.71C141.74 296.97 67.09 256.8 67.09 179.29C66.94 177.1 67.15 109.78 67.15 109.78C67.15 84.73 35.89 88.63 35.89 88.63C35.89 166.51 59.87 190.98 109.92 190.98C168.97 190.98 156.42 159.07 154.91 153.43C148.61 129.85 135.66 104.28 135.66 75.48L135.66 72.76C135.66 34.78 166.3 4.0 204.11 4.0C241.91 4.0 272.55 34.78 272.55 72.76L272.55 75.48C272.55 104.28 259.6 129.85 253.3 153.43C251.79 159.07 239.24 190.98 298.29 190.98C348.34 190.98 372.32 166.51 372.32 88.63C372.32 88.63 341.06 84.73 341.06 109.78C341.06 109.78 341.27 177.1 341.12 179.29C341.12 256.8 266.47 296.97 234.81 313.71C232.74 314.8 235.03 316.61 238.86 318.46C249.46 323.58 261.73 323.94 272.73 319.74C321.59 301.08 243.35 223.15 204.41 199.7"
            fill="none" strokeWidth="7.0" strokeLinecap="butt" strokeLinejoin="miter" />
      <path d="M100.6 262.83C66.3 277.52 35.66 273.21 35.66 224.14L35.66 185.26C35.66 171.38 26.63 161.29 13.24 161.29L4.0 161.29C4.0 193.03 14.09 234.51 56.77 234.51C116.73 237.29 152.64 206.43 183.97 200.57C190.74 199.3 197.62 198.67 204.51 198.67L204.98 198.67C211.87 198.67 218.75 199.3 225.52 200.57C256.85 206.43 292.76 237.29 352.72 234.51C395.4 234.51 405.49 193.03 405.49 161.29L396.25 161.29C382.86 161.29 373.83 171.38 373.83 185.26L373.83 224.14C373.83 275.62 339.42 284.73 303.19 267.99"
            fill="none" strokeWidth="7.0" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M249.6 139.97C249.6 144.17 252.98 147.57 257.15 147.57C261.32 147.57 264.7 144.17 264.7 139.97C264.7 135.77 261.32 132.36 257.15 132.36C252.98 132.36 249.6 135.77 249.6 139.97"
            fill={eyeFill} strokeWidth="7.0" strokeLinecap="round" strokeLinejoin="miter" />
      <path d="M158.61 139.97C158.61 144.17 155.23 147.57 151.06 147.57C146.89 147.57 143.51 144.17 143.51 139.97C143.51 135.77 146.89 132.36 151.06 132.36C155.23 132.36 158.61 135.77 158.61 139.97"
            fill={eyeFill} strokeWidth="7.0" strokeLinecap="round" strokeLinejoin="miter" />
      <path d="M124.47 283.55C148.43 278.23 175.58 275.23 204.34 275.23C235.25 275.23 264.3 278.7 289.54 284.78"
            fill="none" strokeWidth="7.0" strokeLinecap="butt" strokeLinejoin="miter" />
    </svg>
  );
}
