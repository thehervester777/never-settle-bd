/*
 * Chart colours, shared by server pages and client charts (a constant exported from a 'use client'
 * file isn't readable on the server). Validated categorical slots 1–2 and the diverging pair
 * (blue/orange pass every colour-vision check on white); text never wears these colours.
 */
export const SERIES = { blue: '#2a78d6', orange: '#eb6834', red: '#e34948' } as const;
