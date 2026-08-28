export type ArmorCell = '.' | 'd' | 'l' | 'b' | 's'

export const ARMOR_SIZE = 16

export const ARMOR_MASKS: Record<string, string[]> = {
  helmet: [
    '................',
    '................',
    '......dddd......',
    '....ddlbbbdd....',
    '...dlbbbbbbbd...',
    '..dlbbbbbbbbbd..',
    '..dbbbbbbbbbbd..',
    '.dlbbbbbbbbbbsd.',
    '.dlbbbbbbbbbbsd.',
    '.dlbbbbbbbbbbsd.',
    '.dlbbbbbbbbbbsd.',
    '.dlbbbbbbbbbbsd.',
    '.dlbbbbbbbbbbsd.',
    '.dddddddddddddd.',
    '................',
    '................'
  ],
  chestplate: [
    '................',
    '.ddddd....ddddd.',
    '.dlbbd....dbbsd.',
    '.dlbbd....dbbsd.',
    '.dlbbbddddlbbsd.',
    '.dlbbbbbbbbbbsd.',
    '.dlbbbbbbbbbbsd.',
    '.dlbbbbbbbbbbsd.',
    '..dbbbbbbbbbbd..',
    '..dbbbbbbbbbbd..',
    '..dbbbbbbbbbbd..',
    '..dbbbbbbbbbbd..',
    '..dbbbbbbbbbbd..',
    '..dbbbbbbbbbbd..',
    '..ddbbbbbbbsdd..',
    '....dddddddd....'
  ],
  leggings: [
    '.dddddddddddddd.',
    '.dlbbbbbbbbbbsd.',
    '.dlbbbbbbbbbbsd.',
    '.dlbbbsddbbbbsd.',
    '..dbbbd..dbbbd..',
    '..dbbbd..dbbbd..',
    '..dbbbd..dbbbd..',
    '..dbbbd..dbbbd..',
    '..dbbbd..dbbbd..',
    '..dbbbd..dbbbd..',
    '..dbbbd..dbbbd..',
    '..dbbbd..dbbbd..',
    '..dbbbd..dbbbd..',
    '..dbbbd..dbbbd..',
    '..dbbbd..dbbbd..',
    '..ddddd..ddddd..'
  ],
  boots: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..ddddd..ddddd..',
    '..dbbbd..dbbbd..',
    '..dbbbd..dbbbd..',
    '..dbbbd..dbbbd..',
    '..dbbbd..dbbbd..',
    'ddlbbbd..dbbbsdd',
    'dllbbbd..dbbbssd',
    'dllbbbd..dbbbssd',
    'ddddddd..ddddddd',
    '................'
  ]
}
