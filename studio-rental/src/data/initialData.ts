import { Studio, Equipment, Assistant, MaintenanceDay, Order } from '../types';

export const initialStudios: Studio[] = [
  {
    id: 'studio-1',
    name: 'A棚 - 无影墙大空间',
    description: '300平米无影墙专业影棚，适合大型商业拍摄',
    basePricePerHour: 800,
    area: 300,
    maxPeople: 30,
    features: ['无影墙', '空调', '化妆间', '休息区', 'WI-FI'],
    color: '#3b82f6',
  },
  {
    id: 'studio-2',
    name: 'B棚 - 实景客厅',
    description: '北欧风实景客厅，适合家居和生活方式拍摄',
    basePricePerHour: 600,
    area: 150,
    maxPeople: 15,
    features: ['实景客厅', '自然光', '厨房', '卧室场景'],
    color: '#10b981',
  },
  {
    id: 'studio-3',
    name: 'C棚 - 白棚标准间',
    description: '80平米标准白棚，适合产品和人像拍摄',
    basePricePerHour: 400,
    area: 80,
    maxPeople: 10,
    features: ['白棚', '顶灯轨道', '化妆台', '道具间'],
    color: '#f59e0b',
  },
  {
    id: 'studio-4',
    name: 'D棚 - 绿幕虚拟棚',
    description: '专业绿幕棚，支持虚拟场景合成',
    basePricePerHour: 500,
    area: 120,
    maxPeople: 12,
    features: ['绿幕', '灯光系统', '实时预览', '抠像工作站'],
    color: '#8b5cf6',
  },
];

export const initialEquipments: Equipment[] = [
  {
    id: 'light-1',
    name: 'Profoto D2 1000Ws 闪光灯',
    category: 'lighting',
    pricePerHour: 80,
    quantity: 6,
    description: '专业影室闪光灯',
    tags: ['闪光灯', 'Profoto', '高端'],
    compatibleStudios: ['studio-1', 'studio-2', 'studio-3', 'studio-4'],
  },
  {
    id: 'light-2',
    name: '神牛 SL60W 常亮灯',
    category: 'lighting',
    pricePerHour: 30,
    quantity: 10,
    description: 'LED常亮灯，适合视频拍摄',
    tags: ['常亮灯', 'LED', '视频'],
    compatibleStudios: ['studio-1', 'studio-2', 'studio-3', 'studio-4'],
  },
  {
    id: 'light-3',
    name: '柔光箱 120cm 八角',
    category: 'lighting',
    pricePerHour: 20,
    quantity: 8,
    description: '八角柔光箱，光线柔和',
    tags: ['柔光', '附件'],
    compatibleStudios: ['studio-1', 'studio-2', 'studio-3', 'studio-4'],
  },
  {
    id: 'light-4',
    name: '反光伞 金色/银色',
    category: 'lighting',
    pricePerHour: 10,
    quantity: 12,
    description: '反光伞，金/银两用',
    tags: ['反光', '附件'],
    compatibleStudios: ['studio-1', 'studio-2', 'studio-3', 'studio-4'],
  },
  {
    id: 'set-1',
    name: '背景纸 纯白 2.72m',
    category: 'set',
    pricePerHour: 15,
    quantity: 5,
    description: '进口背景纸，纯白',
    tags: ['背景', '白色'],
    compatibleStudios: ['studio-1', 'studio-3'],
  },
  {
    id: 'set-2',
    name: '背景纸 纯黑 2.72m',
    category: 'set',
    pricePerHour: 15,
    quantity: 5,
    description: '进口背景纸，纯黑',
    tags: ['背景', '黑色'],
    compatibleStudios: ['studio-1', 'studio-3'],
  },
  {
    id: 'set-3',
    name: 'C型灯架 魔术腿',
    category: 'set',
    pricePerHour: 15,
    quantity: 8,
    description: '重型灯架，承重强',
    tags: ['灯架', '重型'],
    compatibleStudios: ['studio-1', 'studio-2', 'studio-3', 'studio-4'],
  },
  {
    id: 'prop-1',
    name: '北欧风沙发',
    category: 'prop',
    pricePerHour: 50,
    quantity: 2,
    description: '三人位北欧风格沙发',
    tags: ['家具', '北欧风'],
    compatibleStudios: ['studio-2'],
  },
  {
    id: 'prop-2',
    name: '大理石餐桌椅套装',
    category: 'prop',
    pricePerHour: 80,
    quantity: 1,
    description: '大理石餐桌配4把餐椅',
    tags: ['家具', '餐桌'],
    compatibleStudios: ['studio-2'],
  },
  {
    id: 'prop-3',
    name: '绿植盆栽 大型',
    category: 'prop',
    pricePerHour: 25,
    quantity: 6,
    description: '大型仿真绿植，1.5米以上',
    tags: ['绿植', '装饰'],
    compatibleStudios: ['studio-1', 'studio-2', 'studio-3', 'studio-4'],
  },
];

export const initialAssistants: Assistant[] = [
  {
    id: 'asst-1',
    name: '张小明',
    role: '摄影助理',
    pricePerHour: 100,
    skills: ['灯光', '器材', '布景'],
  },
  {
    id: 'asst-2',
    name: '李小红',
    role: '灯光师',
    pricePerHour: 200,
    skills: ['灯光设计', '布光', '测光'],
  },
  {
    id: 'asst-3',
    name: '王小刚',
    role: '置景师',
    pricePerHour: 150,
    skills: ['布景', '道具', '美术'],
  },
  {
    id: 'asst-4',
    name: '赵小美',
    role: '化妆师',
    pricePerHour: 180,
    skills: ['化妆', '造型', '发型'],
  },
  {
    id: 'asst-5',
    name: '陈小伟',
    role: '摄影助理',
    pricePerHour: 100,
    skills: ['器材', '后期', '灯光'],
  },
];

export function generateInitialOrders(): Order[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const day2 = new Date(today);
  day2.setDate(today.getDate() + 1);
  
  const day3 = new Date(today);
  day3.setDate(today.getDate() + 2);
  
  const day5 = new Date(today);
  day5.setDate(today.getDate() + 4);
  
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
  const fmtDateTime = (d: Date) => d.toISOString().slice(0, 16);
  
  const start1 = new Date(fmtDate(today) + 'T09:00:00');
  const end1 = new Date(fmtDate(today) + 'T12:00:00');
  
  const start2 = new Date(fmtDate(day2) + 'T14:00:00');
  const end2 = new Date(fmtDate(day2) + 'T18:00:00');
  
  const start3 = new Date(fmtDate(day3) + 'T10:00:00');
  const end3 = new Date(fmtDate(day3) + 'T16:00:00');
  
  return [
    {
      id: 'order-1',
      orderNo: 'ST' + now.getFullYear() + '0001',
      studioId: 'studio-1',
      customerName: '创意广告公司',
      customerPhone: '13800138001',
      photographer: '王摄影师',
      startTime: fmtDateTime(start1),
      endTime: fmtDateTime(end1),
      equipments: [
        { equipmentId: 'light-1', quantity: 3 },
        { equipmentId: 'light-3', quantity: 3 },
      ],
      assistantIds: ['asst-1', 'asst-2'],
      setupTime: 1,
      teardownTime: 0.5,
      baseAmount: 2400,
      equipmentAmount: 300,
      assistantAmount: 900,
      depositAmount: 1000,
      depositChannel: 'alipay',
      depositConfirmedAt: fmtDateTime(new Date(now.getTime() - 3600000 * 2)),
      overtimeHours: 0,
      overtimeFee: 0,
      penaltyFee: 0,
      damageFee: 0,
      damages: [],
      invoiceRequired: true,
      invoiceInfo: {
        title: '创意广告有限公司',
        taxNo: '91110000MA01234567',
      },
      status: 'confirmed',
      notes: '客户需要提前30分钟到场布置',
      createdAt: fmtDateTime(new Date(now.getTime() - 3600000 * 24)),
      updatedAt: fmtDateTime(new Date(now.getTime() - 3600000 * 2)),
    },
    {
      id: 'order-2',
      orderNo: 'ST' + now.getFullYear() + '0002',
      studioId: 'studio-2',
      customerName: '时尚杂志',
      customerPhone: '13900139002',
      photographer: '李摄影师',
      startTime: fmtDateTime(start2),
      endTime: fmtDateTime(end2),
      equipments: [
        { equipmentId: 'light-2', quantity: 4 },
        { equipmentId: 'prop-1', quantity: 1 },
        { equipmentId: 'prop-3', quantity: 2 },
      ],
      assistantIds: ['asst-3', 'asst-4'],
      setupTime: 1,
      teardownTime: 1,
      baseAmount: 2400,
      equipmentAmount: 320,
      assistantAmount: 1320,
      depositAmount: 1200,
      overtimeHours: 0,
      overtimeFee: 0,
      penaltyFee: 0,
      damageFee: 0,
      damages: [],
      invoiceRequired: false,
      status: 'pending_deposit',
      depositExpiresAt: fmtDateTime(new Date(now.getTime() + 3600000 * 6)),
      notes: '需要客厅场景全天使用',
      createdAt: fmtDateTime(new Date(now.getTime() - 3600000 * 12)),
      updatedAt: fmtDateTime(new Date(now.getTime() - 3600000 * 12)),
    },
    {
      id: 'order-3',
      orderNo: 'ST' + now.getFullYear() + '0003',
      studioId: 'studio-3',
      customerName: '个人写真客户',
      customerPhone: '13700137003',
      startTime: fmtDateTime(start3),
      endTime: fmtDateTime(end3),
      equipments: [
        { equipmentId: 'light-1', quantity: 2 },
        { equipmentId: 'light-3', quantity: 2 },
        { equipmentId: 'set-1', quantity: 1 },
      ],
      assistantIds: ['asst-5'],
      setupTime: 0.5,
      teardownTime: 0.5,
      baseAmount: 2400,
      equipmentAmount: 230,
      assistantAmount: 600,
      depositAmount: 500,
      depositChannel: 'wechat',
      depositConfirmedAt: fmtDateTime(new Date(now.getTime() - 3600000 * 48)),
      overtimeHours: 0,
      overtimeFee: 0,
      penaltyFee: 0,
      damageFee: 0,
      damages: [],
      invoiceRequired: false,
      status: 'deposit_confirmed',
      createdAt: fmtDateTime(new Date(now.getTime() - 3600000 * 72)),
      updatedAt: fmtDateTime(new Date(now.getTime() - 3600000 * 48)),
    },
    {
      id: 'order-4',
      orderNo: 'ST' + now.getFullYear() + '0004',
      studioId: 'studio-1',
      customerName: '电商品牌',
      customerPhone: '13600136004',
      startTime: fmtDateTime(new Date(fmtDate(day5) + 'T08:00:00')),
      endTime: fmtDateTime(new Date(fmtDate(day5) + 'T20:00:00')),
      equipments: [
        { equipmentId: 'light-1', quantity: 4 },
        { equipmentId: 'light-2', quantity: 4 },
        { equipmentId: 'set-3', quantity: 4 },
      ],
      assistantIds: ['asst-1', 'asst-2', 'asst-3'],
      setupTime: 2,
      teardownTime: 1,
      baseAmount: 9600,
      equipmentAmount: 720,
      assistantAmount: 1800,
      depositAmount: 3000,
      overtimeHours: 0,
      overtimeFee: 0,
      penaltyFee: 0,
      damageFee: 0,
      damages: [],
      invoiceRequired: true,
      invoiceInfo: {
        title: '电商品牌有限公司',
        taxNo: '91310000MA09876543',
      },
      status: 'confirmed',
      notes: '全天包场，产品拍摄',
      createdAt: fmtDateTime(new Date(now.getTime() - 3600000 * 96)),
      updatedAt: fmtDateTime(new Date(now.getTime() - 3600000 * 72)),
    },
  ];
}

export function generateInitialMaintenanceDays(): MaintenanceDay[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const day7 = new Date(today);
  day7.setDate(today.getDate() + 6);
  
  const day10 = new Date(today);
  day10.setDate(today.getDate() + 9);
  
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
  const fmtDateTime = (d: Date) => d.toISOString().slice(0, 16);
  
  return [
    {
      id: 'maint-1',
      studioId: 'studio-3',
      date: fmtDate(day7),
      reason: '灯光设备检修与背景墙维护',
      createdAt: fmtDateTime(new Date(now.getTime() - 3600000 * 48)),
      notifiedOrders: [],
    },
    {
      id: 'maint-2',
      studioId: 'studio-4',
      date: fmtDate(day10),
      reason: '绿幕更换与设备升级',
      createdAt: fmtDateTime(new Date(now.getTime() - 3600000 * 24)),
      notifiedOrders: [],
    },
  ];
}
