// ─────────────────────────────────────────────────────────────
// TOPOLOGY CONSTANTS
// Centralized config values for FTTH network types
// ─────────────────────────────────────────────────────────────

export const CABLE_TYPES = {
  DROP_1_CORE: 1,
  BACKBONE_1_CORE: 1,
  BACKBONE_2_CORE: 2,
  BACKBONE_4_CORE: 4,
  BACKBONE_6_CORE: 6,
  BACKBONE_8_CORE: 8,
  BACKBONE_12_CORE: 12,
  BACKBONE_24_CORE: 24,
  BACKBONE_32_CORE: 32,
  BACKBONE_64_CORE: 64,
  BACKBONE_96_CORE: 96,
};

export const SPLITTER_TYPES = {
  NONE: 0,
  SPLITTER_1_2: 2,
  SPLITTER_1_4: 4,
  SPLITTER_1_8: 8,
  SPLITTER_1_16: 16,
  SPLITTER_1_32: 32,
  SPLITTER_1_64: 64,
};

export const CABLE_LABELS = {
  DROP_1_CORE: 'Drop 1 Core',
  BACKBONE_1_CORE: 'Backbone 1 Core',
  BACKBONE_2_CORE: '2 Core',
  BACKBONE_4_CORE: '4 Core',
  BACKBONE_6_CORE: '6 Core',
  BACKBONE_8_CORE: '8 Core',
  BACKBONE_12_CORE: '12 Core',
  BACKBONE_24_CORE: '24 Core',
  BACKBONE_32_CORE: '32 Core',
  BACKBONE_64_CORE: '64 Core',
  BACKBONE_96_CORE: '96 Core',
};

export const SPLITTER_LABELS = {
  NONE: 'No Splitter',
  SPLITTER_1_2: '1:2',
  SPLITTER_1_4: '1:4',
  SPLITTER_1_8: '1:8',
  SPLITTER_1_16: '1:16',
  SPLITTER_1_32: '1:32',
  SPLITTER_1_64: '1:64',
};

export const DEFAULT_NODE_FORM = {
  id: null, name: '', type: 'ODC', oltPortId: '', parentNodeId: '',
  latitude: '', longitude: '', description: '', cableType: 'BACKBONE_12_CORE',
  totalCore: 12, distanceMeter: '', splitterType: 'SPLITTER_1_8',
};

export const DEFAULT_OLT_PORT_FORM = {
  id: null, name: '', port: '', routerId: '', latitude: '', longitude: '',
};

export const DEFAULT_SPLITTER_FORM = {
  id: null, nodeId: '', type: 'SPLITTER_1_8', outputPort: 8, name: '', description: '',
};

export const DEFAULT_ASSIGN_FORM = {
  outputId: '', clientId: '', targetNodeId: '', assignType: 'client', showExistingNodeSelect: false,
};

export const DEFAULT_USER_FORM = {
  id: '', username: '', latitude: '', longitude: '',
};
