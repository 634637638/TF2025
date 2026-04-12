/**
 * 产品名称映射配置
 * 用于将外部系统的产品名称映射到系统内的标准名称
 */

/**
 * 外部系统名称 -> 系统内标准名称 的映射
 */
const PRODUCT_NAME_MAPPING = {
  // iPad系列
  '苹果11英寸iPad(第十一代)': {
    brand: '苹果',
    model: 'iPad 11',
    external_model: null,
    category: 'tablet'
  },
  '苹果11英寸iPad(第十代)': {
    brand: '苹果',
    model: 'iPad 10',
    external_model: null,
    category: 'tablet'
  },
  '苹果11英寸iPad Pro(第二代)': {
    brand: '苹果',
    model: 'iPad Pro 11',
    external_model: null,
    category: 'tablet'
  },
  '苹果12.9英寸iPad Pro(第六代)': {
    brand: '苹果',
    model: 'iPad Pro 12.9',
    external_model: null,
    category: 'tablet'
  },
  '苹果13英寸iPad Air(第五代)': {
    brand: '苹果',
    model: 'iPad Air 13',
    external_model: null,
    category: 'tablet'
  },
  '苹果10.9英寸iPad Air': {
    brand: '苹果',
    model: 'iPad Air 10.9',
    external_model: null,
    category: 'tablet'
  },
  '苹果ipad Air7': {
    brand: '苹果',
    model: 'ipad Air7',
    external_model: null,
    category: 'tablet'
  },
  'ipad Air7': {
    brand: '苹果',
    model: 'ipad Air7',
    external_model: null,
    category: 'tablet'
  },
  'ipad Air 7': {
    brand: '苹果',
    model: 'ipad Air7',
    external_model: null,
    category: 'tablet'
  },
  'iPad Air 7': {
    brand: '苹果',
    model: 'ipad Air7',
    external_model: null,
    category: 'tablet'
  },
  'iPad Air (第七代)': {
    brand: '苹果',
    model: 'ipad Air7',
    external_model: null,
    category: 'tablet'
  },
  '苹果ipad Air8': {
    brand: '苹果',
    model: 'ipad Air8',
    external_model: null,
    category: 'tablet'
  },
  'ipad Air8': {
    brand: '苹果',
    model: 'ipad Air8',
    external_model: null,
    category: 'tablet'
  },
  'ipad Air 8': {
    brand: '苹果',
    model: 'ipad Air8',
    external_model: null,
    category: 'tablet'
  },
  'iPad Air 8': {
    brand: '苹果',
    model: 'ipad Air8',
    external_model: null,
    category: 'tablet'
  },
  'iPad Air (第八代)': {
    brand: '苹果',
    model: 'ipad Air8',
    external_model: null,
    category: 'tablet'
  },
  'ipad Air6': {
    brand: '苹果',
    model: 'ipad Air6',
    external_model: null,
    category: 'tablet'
  },
  'ipad Air 6': {
    brand: '苹果',
    model: 'ipad Air6',
    external_model: null,
    category: 'tablet'
  },
  'ipadAIR5': {
    brand: '苹果',
    model: 'ipadAIR5',
    external_model: null,
    category: 'tablet'
  },
  'ipadAIR4': {
    brand: '苹果',
    model: 'ipadAIR4',
    external_model: null,
    category: 'tablet'
  },
  'ipadAIR3': {
    brand: '苹果',
    model: 'ipadAIR3',
    external_model: null,
    category: 'tablet'
  },
  'ipadAIR2': {
    brand: '苹果',
    model: 'ipadAIR2',
    external_model: null,
    category: 'tablet'
  },
  'ipad10': {
    brand: '苹果',
    model: 'ipad10',
    external_model: null,
    category: 'tablet'
  },
  'ipad9': {
    brand: '苹果',
    model: 'ipad9',
    external_model: null,
    category: 'tablet'
  },
  'ipad8': {
    brand: '苹果',
    model: 'ipad8',
    external_model: null,
    category: 'tablet'
  },
  'ipad7': {
    brand: '苹果',
    model: 'ipad7',
    external_model: null,
    category: 'tablet'
  },
  'ipad5': {
    brand: '苹果',
    model: 'ipad5',
    external_model: null,
    category: 'tablet'
  },

  // iPhone系列
  '苹果iPhone 17E': {
    brand: '苹果',
    model: 'iphone 17E',
    external_model: 'A3635',
    category: 'phone'
  },
  'iPhone 17E': {
    brand: '苹果',
    model: 'iphone 17E',
    external_model: 'A3635',
    category: 'phone'
  },
  'iPhone 17E (A3635)': {
    brand: '苹果',
    model: 'iphone 17E',
    external_model: 'A3635',
    category: 'phone'
  },
  '苹果iPhone 17 Air': {
    brand: '苹果',
    model: 'iphone17air',
    external_model: 'A3518',
    category: 'phone'
  },
  '苹果 iPhone Air': {
    brand: '苹果',
    model: 'iphone17air',
    external_model: 'A3518',
    category: 'phone'
  },
  'iPhone Air': {
    brand: '苹果',
    model: 'iphone17air',
    external_model: 'A3518',
    category: 'phone'
  },
  'iPhone Air(A3518)': {
    brand: '苹果',
    model: 'iphone17air',
    external_model: 'A3518',
    category: 'phone'
  },
  '苹果 iPhone Air(A3518)': {
    brand: '苹果',
    model: 'iphone17air',
    external_model: 'A3518',
    category: 'phone'
  },
  '苹果iPhone 17': {
    brand: '苹果',
    model: 'iphone17',
    external_model: 'A3521',
    category: 'phone'
  },
  '苹果iPhone 17 Pro': {
    brand: '苹果',
    model: 'iphone17pro',
    external_model: 'A3524',
    category: 'phone'
  },
  '苹果iPhone 17 Pro Max': {
    brand: '苹果',
    model: '17promax',
    external_model: 'A3527',
    category: 'phone'
  },
  '苹果17air': {
    brand: '苹果',
    model: 'iphone17air',
    external_model: 'A3518',
    category: 'phone'
  },
  '17air': {
    brand: '苹果',
    model: 'iphone17air',
    external_model: 'A3518',
    category: 'phone'
  },
  '苹果17promax': {
    brand: '苹果',
    model: '17promax',
    external_model: 'A3527',
    category: 'phone'
  },
  '17promax': {
    brand: '苹果',
    model: '17promax',
    external_model: 'A3527',
    category: 'phone'
  },
  '苹果17pro': {
    brand: '苹果',
    model: 'iphone17pro',
    external_model: 'A3524',
    category: 'phone'
  },
  '17pro': {
    brand: '苹果',
    model: 'iphone17pro',
    external_model: 'A3524',
    category: 'phone'
  },
  '苹果17': {
    brand: '苹果',
    model: 'iphone17',
    external_model: 'A3521',
    category: 'phone'
  },
  '17': {
    brand: '苹果',
    model: 'iphone17',
    external_model: 'A3521',
    category: 'phone'
  },
  '16promax': {
    brand: '苹果',
    model: '16promax',
    external_model: 'A3295',
    category: 'phone'
  },
  '16pro': {
    brand: '苹果',
    model: '16pro',
    external_model: 'A3294',
    category: 'phone'
  },
  '15promax': {
    brand: '苹果',
    model: '15promax',
    external_model: 'A3224',
    category: 'phone'
  },
  '15pro': {
    brand: '苹果',
    model: '15pro',
    external_model: 'A3223',
    category: 'phone'
  },
  '苹果iPhone 16': {
    brand: '苹果',
    model: 'iPhone 16',
    external_model: 'A3288',
    category: 'phone'
  },
  '苹果iPhone 16E': {
    brand: '苹果',
    model: 'iPhone16e',
    external_model: 'A3410',
    category: 'phone'
  },
  '苹果iPhone16e': {
    brand: '苹果',
    model: 'iPhone16e',
    external_model: 'A3410',
    category: 'phone'
  },
  '苹果iphone 16E': {
    brand: '苹果',
    model: 'iPhone16e',
    external_model: 'A3410',
    category: 'phone'
  },
  'iPhone 16E': {
    brand: '苹果',
    model: 'iPhone16e',
    external_model: 'A3410',
    category: 'phone'
  },
  'iPhone16e': {
    brand: '苹果',
    model: 'iPhone16e',
    external_model: 'A3410',
    category: 'phone'
  },
  'iphone 16E': {
    brand: '苹果',
    model: 'iPhone16e',
    external_model: 'A3410',
    category: 'phone'
  },
  'iphone16e': {
    brand: '苹果',
    model: 'iPhone16e',
    external_model: 'A3410',
    category: 'phone'
  },
  '16e': {
    brand: '苹果',
    model: 'iPhone16e',
    external_model: 'A3410',
    category: 'phone'
  },
  '苹果iPhone 16 Plus': {
    brand: '苹果',
    model: 'iPhone 16 Plus',
    external_model: 'A3291',
    category: 'phone'
  },
  '苹果iPhone 16 Pro': {
    brand: '苹果',
    model: 'iPhone 16 Pro',
    external_model: 'A3294',
    category: 'phone'
  },
  '苹果iPhone 16 Pro Max': {
    brand: '苹果',
    model: 'iPhone 16 Pro Max',
    external_model: 'A3297',
    category: 'phone'
  },
  '苹果iPhone 15': {
    brand: '苹果',
    model: 'iPhone 15',
    external_model: 'A3222',
    category: 'phone'
  },
  '苹果iPhone 15 Plus': {
    brand: '苹果',
    model: 'iPhone 15 Plus',
    external_model: 'A3218',
    category: 'phone'
  },
  '苹果iPhone 15 Pro': {
    brand: '苹果',
    model: 'iPhone 15 Pro',
    external_model: 'A3223',
    category: 'phone'
  },
  '苹果iPhone 15 Pro Max': {
    brand: '苹果',
    model: 'iPhone 15 Pro Max',
    external_model: 'A3224',
    category: 'phone'
  },

  // MacBook系列
  '苹果13.6英寸MacBook Air': {
    brand: '苹果',
    model: 'MacBook Air 13.6',
    external_model: null,
    category: 'laptop'
  },
  '苹果13英寸MacBook Air': {
    brand: '苹果',
    model: 'MacBook Air 13',
    external_model: null,
    category: 'laptop'
  },
  '苹果15.3英寸MacBook Air': {
    brand: '苹果',
    model: 'MacBook Air 15.3',
    external_model: null,
    category: 'laptop'
  },
  '苹果14.2英寸MacBook Pro': {
    brand: '苹果',
    model: 'MacBook Pro 14.2',
    external_model: null,
    category: 'laptop'
  },
  '苹果16.2英寸MacBook Pro': {
    brand: '苹果',
    model: 'MacBook Pro 16.2',
    external_model: null,
    category: 'laptop'
  },

  // 其他产品
  '苹果AirPods 4': {
    brand: '苹果',
    model: 'AirPods 4',
    external_model: null,
    category: 'accessory'
  },
  '苹果AirPods 4白色': {
    brand: '苹果',
    model: 'AirPods 4',
    external_model: null,
    category: 'accessory'
  },
  '苹果AirPods 4(支持主动降噪)': {
    brand: '苹果',
    model: 'AirPods 4',
    external_model: null,
    category: 'accessory'
  },
  '苹果AirPods Max': {
    brand: '苹果',
    model: 'AirPods Max',
    external_model: null,
    category: 'accessory'
  },
  'AirPods Pro 3': {
    brand: '苹果',
    model: 'AirPods Pro 3',
    external_model: null,
    category: 'accessory'
  },
  'AirPods 4': {
    brand: '苹果',
    model: 'AirPods 4',
    external_model: null,
    category: 'accessory'
  },
  '苹果AirPods Pro(第二代)': {
    brand: '苹果',
    model: 'AirPods Pro 2',
    external_model: null,
    category: 'accessory'
  },
  '苹果AirPods Pro2': {
    brand: '苹果',
    model: 'AirPods Pro 2',
    external_model: null,
    category: 'accessory'
  },
  '苹果AirPods Pro(第三代)': {
    brand: '苹果',
    model: 'AirPods Pro 3',
    external_model: null,
    category: 'accessory'
  },
  '苹果AirPods Pro3': {
    brand: '苹果',
    model: 'AirPods Pro 3',
    external_model: null,
    category: 'accessory'
  },
  '苹果AirPods Pro3(USB-C)': {
    brand: '苹果',
    model: 'AirPods Pro 3',
    external_model: null,
    category: 'accessory'
  },
  '苹果AirPods 3': {
    brand: '苹果',
    model: 'AirPods 3',
    external_model: null,
    category: 'accessory'
  },
  '苹果AirPods 4': {
    brand: '苹果',
    model: 'AirPods 4',
    external_model: null,
    category: 'accessory'
  },
  '苹果AirPods Max': {
    brand: '苹果',
    model: 'AirPods Max',
    external_model: null,
    category: 'accessory'
  },
  'AirPods Pro 3': {
    brand: '苹果',
    model: 'AirPods Pro 3',
    external_model: null,
    category: 'accessory'
  },
  'AirPods 4': {
    brand: '苹果',
    model: 'AirPods 4',
    external_model: null,
    category: 'accessory'
  }
};

/**
 * 模糊匹配产品名称 - 通过关键字搜索
 * @param {string} externalName - 外部系统名称
 * @returns {Object|null} 匹配的产品信息
 */
function matchProductName(externalName) {
  // 直接匹配
  if (PRODUCT_NAME_MAPPING[externalName]) {
    return PRODUCT_NAME_MAPPING[externalName];
  }

  // 标准化输入字符串（去除空格，转为小写）
  let normalizedInput = externalName.toLowerCase().replace(/\s+/g, '');

  // 🔥 去除 "苹果" 前缀，以便更好地匹配型号（如 苹果17promax -> 17promax）
  if (normalizedInput.startsWith('苹果')) {
    normalizedInput = normalizedInput.substring(2);
  }
  // 也去除英文 "apple" 前缀
  if (normalizedInput.startsWith('apple')) {
    normalizedInput = normalizedInput.substring(5);
  }

  // 如果去掉前缀后为空，恢复原字符串
  if (!normalizedInput) {
    normalizedInput = externalName.toLowerCase().replace(/\s+/g, '');
  }

  // iPad 关键字匹配 - 支持格式: "苹果11英寸iPad(第十一代)-128GB-粉色"
  if (normalizedInput.includes('ipad') || normalizedInput.includes('平板')) {
    if (normalizedInput.includes('妙控键盘') || normalizedInput.includes('键盘')) {
      return null;
    }

    // iPad mini 不应落到 Air 系列，否则会把 mini 价格串到 Air7。
    if (normalizedInput.includes('mini')) {
      return null;
    }

    // 🔥 优先匹配具体型号：iPad Air 8 / Air 7 / Air 6
    // 这里必须使用精确代际匹配，不能只用 includes('6'/'7'/'8')
    // 否则会被 256GB、26款、11英寸 这类数字误伤
    if (
      /air8(?!\d)/.test(normalizedInput) ||
      normalizedInput.includes('第八代') ||
      (normalizedInput.includes('air') && normalizedInput.includes('m4'))
    ) {
      return {
        brand: '苹果',
        model: 'ipad Air8',
        external_model: null,
        category: 'tablet'
      };
    }
    if (
      /air7(?!\d)/.test(normalizedInput) ||
      normalizedInput.includes('第七代')
    ) {
      return {
        brand: '苹果',
        model: 'ipad Air7',
        external_model: null,
        category: 'tablet'
      };
    }
    // iPad Air (第十一代/13英寸)
    if (normalizedInput.includes('air') && (normalizedInput.includes('13') || normalizedInput.includes('第十一代') || normalizedInput.includes('11gen'))) {
      return {
        brand: '苹果',
        model: 'iPad Air 13',
        external_model: null,
        category: 'tablet'
      };
    }
    // iPad Air 6
    if (
      /air6(?!\d)/.test(normalizedInput) ||
      normalizedInput.includes('第六代')
    ) {
      return {
        brand: '苹果',
        model: 'ipad Air6',
        external_model: null,
        category: 'tablet'
      };
    }
    // iPad Air 5
    if (normalizedInput.includes('air') && normalizedInput.includes('5')) {
      return {
        brand: '苹果',
        model: 'ipadAIR5',
        external_model: null,
        category: 'tablet'
      };
    }
    // iPad Air 4
    if (normalizedInput.includes('air') && normalizedInput.includes('4')) {
      return {
        brand: '苹果',
        model: 'ipadAIR4',
        external_model: null,
        category: 'tablet'
      };
    }
    // iPad Air 3
    if (normalizedInput.includes('air') && normalizedInput.includes('3')) {
      return {
        brand: '苹果',
        model: 'ipadAIR3',
        external_model: null,
        category: 'tablet'
      };
    }
    // iPad Air 2
    if (normalizedInput.includes('air') && normalizedInput.includes('2')) {
      return {
        brand: '苹果',
        model: 'ipadAIR2',
        external_model: null,
        category: 'tablet'
      };
    }
    // iPad Pro 11英寸 (M5)
    if (normalizedInput.includes('pro') && (normalizedInput.includes('11') || normalizedInput.includes('m5'))) {
      return {
        brand: '苹果',
        model: 'iPad Pro 11',
        external_model: null,
        category: 'tablet'
      };
    }
    // iPad Pro 12.9/13英寸 (M5)
    if (normalizedInput.includes('pro') && (normalizedInput.includes('12.9') || normalizedInput.includes('13') || normalizedInput.includes('m5'))) {
      return {
        brand: '苹果',
        model: 'iPad Pro 12.9',
        external_model: null,
        category: 'tablet'
      };
    }
    // iPad Air (通用，优先级最低)
    if (normalizedInput.includes('air')) {
      if (normalizedInput.includes('10.9')) {
        return {
          brand: '苹果',
          model: 'iPad Air 10.9',
          external_model: null,
          category: 'tablet'
        };
      }
      return {
        brand: '苹果',
        model: 'ipad Air7', // 🔥 默认匹配到最新型号 Air 7
        external_model: null,
        category: 'tablet'
      };
    }
    // iPad 11 (第十一代) - 排除 iPhone 11 Pro/Max 等手机型号
    if (normalizedInput.includes('11') && !normalizedInput.includes('air')) {
      // 排除 iPhone 11 Pro 系列和 11promax 等手机型号
      if (normalizedInput.includes('pro') || normalizedInput.includes('max') ||
          normalizedInput.includes('promax') || normalizedInput.includes('iphone')) {
        // 不匹配，让其他规则处理或返回 null
        return null;
      }
      return {
        brand: '苹果',
        model: 'iPad 11',
        external_model: null,
        category: 'tablet'
      };
    }
    // iPad 10 (第十代)
    if (normalizedInput.includes('10') && !normalizedInput.includes('air')) {
      return {
        brand: '苹果',
        model: 'ipad10',
        external_model: null,
        category: 'tablet'
      };
    }
    // 通用iPad
    return {
      brand: '苹果',
      model: 'iPad',
      external_model: null,
      category: 'tablet'
    };
  }

  // MacBook 关键字匹配
  if (normalizedInput.includes('macbook')) {
    if (normalizedInput.includes('pro')) {
      if (normalizedInput.includes('14') || normalizedInput.includes('14.2')) {
        return {
          brand: '苹果',
          model: 'MacBook Pro 14',
          external_model: null,
          category: 'laptop'
        };
      }
      if (normalizedInput.includes('16') || normalizedInput.includes('16.2')) {
        return {
          brand: '苹果',
          model: 'MacBook Pro 16',
          external_model: null,
          category: 'laptop'
        };
      }
      return {
        brand: '苹果',
        model: 'MacBook Pro',
        external_model: null,
        category: 'laptop'
      };
    }
    if (normalizedInput.includes('air')) {
      if (normalizedInput.includes('15') || normalizedInput.includes('15.3')) {
        return {
          brand: '苹果',
          model: 'MacBook Air 15',
          external_model: null,
          category: 'laptop'
        };
      }
      if (normalizedInput.includes('13') || normalizedInput.includes('13.6')) {
        return {
          brand: '苹果',
          model: 'MacBook Air 13',
          external_model: null,
          category: 'laptop'
        };
      }
      return {
        brand: '苹果',
        model: 'MacBook Air',
        external_model: null,
        category: 'laptop'
      };
    }
  }

  // AirPods 关键字匹配
  if (normalizedInput.includes('airpods') || normalizedInput.includes('air pods')) {
    if (normalizedInput.includes('max')) {
      return {
        brand: '苹果',
        model: 'AirPods Max',
        external_model: null,
        category: 'accessory'
      };
    }
    if (normalizedInput.includes('pro')) {
      // 检查是否是第3代或第2代
      if (normalizedInput.includes('3') || normalizedInput.includes('pro3') || normalizedInput.includes('第三代')) {
        return {
          brand: '苹果',
          model: 'AirPods Pro 3',
          external_model: null,
          category: 'accessory'
        };
      }
      if (normalizedInput.includes('2') || normalizedInput.includes('pro2') || normalizedInput.includes('第二代')) {
        return {
          brand: '苹果',
          model: 'AirPods Pro 2',
          external_model: null,
          category: 'accessory'
        };
      }
      return {
        brand: '苹果',
        model: 'AirPods Pro',
        external_model: null,
        category: 'accessory'
      };
    }
    // 检查是否是 AirPods 4
    if (normalizedInput.includes('4')) {
      return {
        brand: '苹果',
        model: 'AirPods 4',
        external_model: null,
        category: 'accessory'
      };
    }
    // 检查是否是 AirPods 3
    if (normalizedInput.includes('3')) {
      return {
        brand: '苹果',
        model: 'AirPods 3',
        external_model: null,
        category: 'accessory'
      };
    }
    return {
      brand: '苹果',
      model: 'AirPods',
      external_model: null,
      category: 'accessory'
    };
  }

  // 🔥 特殊处理：iPhone Air（没有数字）-> 匹配到 iphone17air
  if (normalizedInput.includes('iphone') && normalizedInput.includes('air')) {
    return { brand: '苹果', model: 'iphone17air', external_model: 'A3518', category: 'phone' };
  }

  // iPhone 关键字匹配 - 返回数据库中实际使用的型号名称
  if (normalizedInput.includes('iphone')) {
    // iPhone 17E - 必须在 17 之前检查，使用精确匹配避免被 17 覆盖
    if (/17e[^a-z0-9]|^17e$/i.test(normalizedInput)) {
      return { brand: '苹果', model: 'iphone 17E', external_model: 'A3635', category: 'phone' };
    }
    if (normalizedInput.includes('16e') || normalizedInput.includes('a3410')) {
      return { brand: '苹果', model: 'iPhone16e', external_model: 'A3410', category: 'phone' };
    }
    if (normalizedInput.includes('17')) {
      if (normalizedInput.includes('air')) {
        return { brand: '苹果', model: 'iphone17air', external_model: 'A3518', category: 'phone' };
      } else if (normalizedInput.includes('pro') && normalizedInput.includes('max')) {
        return { brand: '苹果', model: '17promax', external_model: 'A3527', category: 'phone' };
      } else if (normalizedInput.includes('pro')) {
        return { brand: '苹果', model: 'iphone17pro', external_model: 'A3524', category: 'phone' };
      } else {
        // 精确匹配 "17"，不匹配 "17e" 等变体
        if (/17[^a-z0-9]|^17$/i.test(normalizedInput)) {
          return { brand: '苹果', model: 'iphone17', external_model: 'A3521', category: 'phone' };
        }
      }
    }
    if (normalizedInput.includes('16')) {
      if (normalizedInput.includes('pro') && normalizedInput.includes('max')) {
        return { brand: '苹果', model: '16promax', external_model: 'A3295', category: 'phone' };
      } else if (normalizedInput.includes('pro')) {
        return { brand: '苹果', model: '16pro', external_model: 'A3294', category: 'phone' };
      } else if (normalizedInput.includes('plus')) {
        return { brand: '苹果', model: 'iPhone 16 Plus', external_model: 'A3291', category: 'phone' };
      } else {
        return { brand: '苹果', model: 'iPhone 16', external_model: 'A3288', category: 'phone' };
      }
    }
    if (normalizedInput.includes('15')) {
      if (normalizedInput.includes('pro') && normalizedInput.includes('max')) {
        return { brand: '苹果', model: '15promax', external_model: 'A3224', category: 'phone' };
      } else if (normalizedInput.includes('pro')) {
        return { brand: '苹果', model: '15pro', external_model: 'A3223', category: 'phone' };
      } else if (normalizedInput.includes('plus')) {
        return { brand: '苹果', model: 'iPhone 15 Plus', external_model: 'A3218', category: 'phone' };
      } else {
        return { brand: '苹果', model: 'iPhone 15', external_model: 'A3222', category: 'phone' };
      }
    }
  }

  // 🔥 数字开头的关键字匹配（如 17promax, 17pro, 17, 16pro 等）
  // 这些是库存表中使用的简写型号，直接返回数据库中的型号名称
  if (/^\d/.test(normalizedInput)) {
    // 17E 系列 - 必须在 17 之前匹配，否则会被 17 覆盖
    // 使用正则精确匹配 "17e" 后面不跟其他数字，避免匹配 17/17pro/17promax
    if (/17e[^0-9]|^17e$/.test(normalizedInput)) {
      return { brand: '苹果', model: 'iphone 17E', external_model: 'A3635', category: 'phone' };
    }
    if (normalizedInput.includes('16e') || normalizedInput.includes('a3410')) {
      return { brand: '苹果', model: 'iPhone16e', external_model: 'A3410', category: 'phone' };
    }
    // 17 系列
    if (normalizedInput.includes('17')) {
      if (normalizedInput.includes('promax') || (normalizedInput.includes('pro') && normalizedInput.includes('max'))) {
        return { brand: '苹果', model: '17promax', external_model: 'A3527', category: 'phone' };
      }
      if (normalizedInput.includes('pro')) {
        return { brand: '苹果', model: 'iphone17pro', external_model: 'A3524', category: 'phone' };
      }
      if (normalizedInput.includes('air')) {
        return { brand: '苹果', model: 'iphone17air', external_model: 'A3518', category: 'phone' };
      }
      // 精确匹配 "17"，不匹配 "17e"、"17pro" 等变体
      if (/17[^a-z0-9]|^17$/.test(normalizedInput)) {
        return { brand: '苹果', model: 'iphone17', external_model: 'A3521', category: 'phone' };
      }
    }
    // 16 系列
    if (normalizedInput.includes('16')) {
      if (normalizedInput.includes('promax') || (normalizedInput.includes('pro') && normalizedInput.includes('max'))) {
        return { brand: '苹果', model: '16promax', external_model: 'A3295', category: 'phone' };
      }
      if (normalizedInput.includes('pro')) {
        return { brand: '苹果', model: '16pro', external_model: 'A3294', category: 'phone' };
      }
      if (normalizedInput.includes('plus')) {
        return { brand: '苹果', model: 'iPhone 16 Plus', external_model: 'A3291', category: 'phone' };
      }
      if (normalizedInput.includes('16')) {
        return { brand: '苹果', model: 'iPhone 16', external_model: 'A3288', category: 'phone' };
      }
    }
    // 15 系列
    if (normalizedInput.includes('15')) {
      if (normalizedInput.includes('promax') || (normalizedInput.includes('pro') && normalizedInput.includes('max'))) {
        return { brand: '苹果', model: '15promax', external_model: 'A3224', category: 'phone' };
      }
      if (normalizedInput.includes('pro')) {
        return { brand: '苹果', model: '15pro', external_model: 'A3223', category: 'phone' };
      }
      if (normalizedInput.includes('15')) {
        return { brand: '苹果', model: 'iPhone 15', external_model: 'A3222', category: 'phone' };
      }
    }
  }

  return null;
}

module.exports = {
  PRODUCT_NAME_MAPPING,
  matchProductName
};
