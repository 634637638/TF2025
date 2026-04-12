<!--
  城市省份选择组件
  提供中国省份和城市的选择功能
-->
<template>
  <div class="city-selector">
    <div class="form-group" v-if="!hideProvince">
      <label>
        省份 <span class="required" v-if="required">*</span>
      </label>
      <select
        v-model="selectedProvince"
        class="form-control"
        :class="{ 'is-invalid': error && !selectedProvince }"
        @change="handleProvinceChange"
        :disabled="disabled"
      >
        <option value="">请选择省份</option>
        <option
          v-for="province in provinces"
          :key="province.code"
          :value="province.code"
        >
          {{ province.name }}
        </option>
      </select>
      <div v-if="error && !selectedProvince" class="invalid-feedback">
        请选择省份
      </div>
    </div>

    <div class="form-group">
      <label>
        城市 <span class="required" v-if="required">*</span>
      </label>
      <select
        v-model="selectedCity"
        class="form-control"
        :class="{ 'is-invalid': error && !selectedCity }"
        @change="handleCityChange"
        :disabled="disabled || (!selectedProvince && !hideProvince)"
      >
        <option value="">请选择城市</option>
        <option
          v-for="city in cities"
          :key="city.code"
          :value="city.name"
        >
          {{ city.name }}
        </option>
      </select>
      <div v-if="error && !selectedCity" class="invalid-feedback">
        请选择城市
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

interface Province {
  code: string
  name: string
  cities: City[]
}

interface City {
  code: string
  name: string
}

interface Props {
  modelValue?: {
    province: string
    city: string
  }
  required?: boolean
  disabled?: boolean
  hideProvince?: boolean
  error?: boolean
}

interface Emits {
  'update:modelValue': [value: { province: string; city: string }]
  'change': [value: { province: string; city: string }]
}

const props = withDefaults(defineProps<Props>(), {
  required: false,
  disabled: false,
  hideProvince: false,
  error: false
})

const emit = defineEmits<Emits>()

// 省份数据
const provinces = ref<Province[]>([
  {
    code: '11',
    name: '北京市',
    cities: [
      { code: '1101', name: '东城区' },
      { code: '1102', name: '西城区' },
      { code: '1103', name: '朝阳区' },
      { code: '1104', name: '丰台区' },
      { code: '1105', name: '石景山区' },
      { code: '1106', name: '海淀区' },
      { code: '1107', name: '门头沟区' },
      { code: '1108', name: '房山区' },
      { code: '1109', name: '通州区' },
      { code: '1110', name: '顺义区' },
      { code: '1111', name: '昌平区' },
      { code: '1112', name: '大兴区' },
      { code: '1113', name: '怀柔区' },
      { code: '1114', name: '平谷区' },
      { code: '1115', name: '密云区' },
      { code: '1116', name: '延庆区' }
    ]
  },
  {
    code: '31',
    name: '上海市',
    cities: [
      { code: '3101', name: '黄浦区' },
      { code: '3102', name: '徐汇区' },
      { code: '3103', name: '长宁区' },
      { code: '3104', name: '静安区' },
      { code: '3105', name: '普陀区' },
      { code: '3106', name: '虹口区' },
      { code: '3107', name: '杨浦区' },
      { code: '3108', name: '闵行区' },
      { code: '3109', name: '宝山区' },
      { code: '3110', name: '嘉定区' },
      { code: '3111', name: '浦东新区' },
      { code: '3112', name: '金山区' },
      { code: '3113', name: '松江区' },
      { code: '3114', name: '青浦区' },
      { code: '3115', name: '奉贤区' },
      { code: '3116', name: '崇明区' }
    ]
  },
  {
    code: '44',
    name: '广东省',
    cities: [
      { code: '4401', name: '广州市' },
      { code: '4403', name: '深圳市' },
      { code: '4404', name: '珠海市' },
      { code: '4405', name: '汕头市' },
      { code: '4406', name: '佛山市' },
      { code: '4407', name: '韶关市' },
      { code: '4408', name: '湛江市' },
      { code: '4409', name: '肇庆市' },
      { code: '4412', name: '梅州市' },
      { code: '4413', name: '惠州市' },
      { code: '4414', name: '汕尾市' },
      { code: '4415', name: '东莞市' },
      { code: '4416', name: '中山市' },
      { code: '4417', name: '江门市' },
      { code: '4418', name: '阳江市' },
      { code: '4419', name: '湛江市' },
      { code: '4420', name: '茂名市' },
      { code: '4421', name: '肇庆市' },
      { code: '4422', name: '清远市' },
      { code: '4423', name: '潮州市' },
      { code: '4424', name: '揭阳市' },
      { code: '4425', name: '云浮市' }
    ]
  },
  {
    code: '32',
    name: '江苏省',
    cities: [
      { code: '3201', name: '南京市' },
      { code: '3202', name: '无锡市' },
      { code: '3203', name: '徐州市' },
      { code: '3204', name: '常州市' },
      { code: '3205', name: '苏州市' },
      { code: '3206', name: '南通市' },
      { code: '3207', name: '连云港市' },
      { code: '3208', name: '淮安市' },
      { code: '3209', name: '盐城市' },
      { code: '3210', name: '扬州市' },
      { code: '3211', name: '镇江市' },
      { code: '3212', name: '泰州市' },
      { code: '3213', name: '宿迁市' }
    ]
  },
  {
    code: '33',
    name: '浙江省',
    cities: [
      { code: '3301', name: '杭州市' },
      { code: '3302', name: '宁波市' },
      { code: '3303', name: '温州市' },
      { code: '3304', name: '嘉兴市' },
      { code: '3305', name: '湖州市' },
      { code: '3306', name: '绍兴市' },
      { code: '3307', name: '金华市' },
      { code: '3308', name: '衢州市' },
      { code: '3309', name: '舟山市' },
      { code: '3310', name: '台州市' },
      { code: '3311', name: '丽水市' }
    ]
  },
  {
    code: '41',
    name: '河南省',
    cities: [
      { code: '4101', name: '郑州市' },
      { code: '4102', name: '开封市' },
      { code: '4103', name: '洛阳市' },
      { code: '4104', name: '平顶山市' },
      { code: '4105', name: '安阳市' },
      { code: '4106', name: '鹤壁市' },
      { code: '4107', name: '新乡市' },
      { code: '4108', name: '焦作市' },
      { code: '4109', name: '濮阳市' },
      { code: '4110', name: '许昌市' },
      { code: '4111', name: '漯河市' },
      { code: '4112', name: '三门峡市' },
      { code: '4113', name: '南阳市' },
      { code: '4114', name: '商丘市' },
      { code: '4115', name: '信阳市' },
      { code: '4116', name: '周口市' },
      { code: '4117', name: '驻马店市' }
    ]
  },
  {
    code: '42',
    name: '湖北省',
    cities: [
      { code: '4201', name: '武汉市' },
      { code: '4202', name: '黄石市' },
      { code: '4203', name: '十堰市' },
      { code: '4205', name: '宜昌市' },
      { code: '4206', name: '襄阳市' },
      { code: '4207', name: '鄂州市' },
      { code: '4208', name: '荆门市' },
      { code: '4209', name: '孝感市' },
      { code: '4210', name: '荆州市' },
      { code: '4211', name: '黄冈市' },
      { code: '4212', name: '咸宁市' },
      { code: '4213', name: '随州市' },
      { code: '4228', name: '恩施土家族苗族自治州' }
    ]
  },
  {
    code: '43',
    name: '湖南省',
    cities: [
      { code: '4301', name: '长沙市' },
      { code: '4302', name: '株洲市' },
      { code: '4303', name: '湘潭市' },
      { code: '4304', name: '衡阳市' },
      { code: '4305', name: '邵阳市' },
      { code: '4306', name: '岳阳市' },
      { code: '4307', name: '常德市' },
      { code: '4308', name: '张家界市' },
      { code: '4309', name: '益阳市' },
      { code: '4310', name: '郴州市' },
      { code: '4311', name: '永州市' },
      { code: '4312', name: '怀化市' },
      { code: '4313', name: '娄底市' },
      { code: '4331', name: '湘西土家族苗族自治州' }
    ]
  },
  {
    code: '34',
    name: '安徽省',
    cities: [
      { code: '3401', name: '合肥市' },
      { code: '3402', name: '芜湖市' },
      { code: '3403', name: '蚌埠市' },
      { code: '3404', name: '淮南市' },
      { code: '3405', name: '马鞍山市' },
      { code: '3406', name: '淮北市' },
      { code: '3407', name: '铜陵市' },
      { code: '3408', name: '安庆市' },
      { code: '3410', name: '黄山市' },
      { code: '3411', name: '滁州市' },
      { code: '3412', name: '阜阳市' },
      { code: '3413', name: '宿州市' },
      { code: '3414', name: '六安市' },
      { code: '3415', name: '亳州市' },
      { code: '3416', name: '池州市' },
      { code: '3417', name: '宣城市' }
    ]
  },
  {
    code: '35',
    name: '福建省',
    cities: [
      { code: '3501', name: '福州市' },
      { code: '3502', name: '厦门市' },
      { code: '3503', name: '莆田市' },
      { code: '3504', name: '三明市' },
      { code: '3505', name: '泉州市' },
      { code: '3506', name: '漳州市' },
      { code: '3507', name: '南平市' },
      { code: '3508', name: '龙岩市' },
      { code: '3509', name: '宁德市' }
    ]
  },
  {
    code: '36',
    name: '江西省',
    cities: [
      { code: '3601', name: '南昌市' },
      { code: '3602', name: '景德镇市' },
      { code: '3603', name: '萍乡市' },
      { code: '3604', name: '九江市' },
      { code: '3605', name: '新余市' },
      { code: '3606', name: '鹰潭市' },
      { code: '3607', name: '赣州市' },
      { code: '3608', name: '吉安市' },
      { code: '3609', name: '宜春市' },
      { code: '3610', name: '抚州市' },
      { code: '3611', name: '上饶市' }
    ]
  },
  {
    code: '37',
    name: '山东省',
    cities: [
      { code: '3701', name: '济南市' },
      { code: '3702', name: '青岛市' },
      { code: '3703', name: '淄博市' },
      { code: '3704', name: '枣庄市' },
      { code: '3705', name: '东营市' },
      { code: '3706', name: '烟台市' },
      { code: '3707', name: '潍坊市' },
      { code: '3708', name: '济宁市' },
      { code: '3709', name: '泰安市' },
      { code: '3710', name: '威海市' },
      { code: '3711', name: '日照市' },
      { code: '3713', name: '临沂市' },
      { code: '3714', name: '德州市' },
      { code: '3715', name: '聊城市' },
      { code: '3716', name: '滨州市' },
      { code: '3717', name: '菏泽市' }
    ]
  },
  {
    code: '13',
    name: '河北省',
    cities: [
      { code: '1301', name: '石家庄市' },
      { code: '1302', name: '唐山市' },
      { code: '1303', name: '秦皇岛市' },
      { code: '1304', name: '邯郸市' },
      { code: '1305', name: '邢台市' },
      { code: '1306', name: '保定市' },
      { code: '1307', name: '张家口市' },
      { code: '1308', name: '承德市' },
      { code: '1309', name: '沧州市' },
      { code: '1310', name: '廊坊市' },
      { code: '1311', name: '衡水市' }
    ]
  },
  {
    code: '14',
    name: '山西省',
    cities: [
      { code: '1401', name: '太原市' },
      { code: '1402', name: '大同市' },
      { code: '1403', name: '阳泉市' },
      { code: '1404', name: '长治市' },
      { code: '1405', name: '晋城市' },
      { code: '1406', name: '朔州市' },
      { code: '1407', name: '晋中市' },
      { code: '1408', name: '运城市' },
      { code: '1409', name: '忻州市' },
      { code: '1410', name: '临汾市' },
      { code: '1411', name: '吕梁市' }
    ]
  },
  {
    code: '15',
    name: '内蒙古自治区',
    cities: [
      { code: '1501', name: '呼和浩特市' },
      { code: '1502', name: '包头市' },
      { code: '1503', name: '乌海市' },
      { code: '1504', name: '赤峰市' },
      { code: '1505', name: '通辽市' },
      { code: '1506', name: '鄂尔多斯市' },
      { code: '1507', name: '呼伦贝尔市' },
      { code: '1508', name: '巴彦淖尔市' },
      { code: '1509', name: '乌兰察布市' },
      { code: '1522', name: '兴安盟' },
      { code: '1525', name: '锡林郭勒盟' },
      { code: '1529', name: '阿拉善盟' }
    ]
  },
  {
    code: '21',
    name: '辽宁省',
    cities: [
      { code: '2101', name: '沈阳市' },
      { code: '2102', name: '大连市' },
      { code: '2103', name: '鞍山市' },
      { code: '2104', name: '抚顺市' },
      { code: '2105', name: '本溪市' },
      { code: '2106', name: '丹东市' },
      { code: '2107', name: '锦州市' },
      { code: '2108', name: '营口市' },
      { code: '2109', name: '阜新市' },
      { code: '2110', name: '辽阳市' },
      { code: '2111', name: '盘锦市' },
      { code: '2112', name: '铁岭市' },
      { code: '2113', name: '朝阳市' },
      { code: '2114', name: '葫芦岛市' }
    ]
  },
  {
    code: '22',
    name: '吉林省',
    cities: [
      { code: '2201', name: '长春市' },
      { code: '2202', name: '吉林市' },
      { code: '2203', name: '四平市' },
      { code: '2204', name: '辽源市' },
      { code: '2205', name: '通化市' },
      { code: '2206', name: '白山市' },
      { code: '2207', name: '松原市' },
      { code: '2208', name: '白城市' },
      { code: '2224', name: '延边朝鲜族自治州' }
    ]
  },
  {
    code: '23',
    name: '黑龙江省',
    cities: [
      { code: '2301', name: '哈尔滨市' },
      { code: '2302', name: '齐齐哈尔市' },
      { code: '2303', name: '鸡西市' },
      { code: '2304', name: '鹤岗市' },
      { code: '2305', name: '双鸭山市' },
      { code: '2306', name: '大庆市' },
      { code: '2307', name: '伊春市' },
      { code: '2308', name: '佳木斯市' },
      { code: '2309', name: '七台河市' },
      { code: '2310', name: '牡丹江市' },
      { code: '2311', name: '黑河市' },
      { code: '2312', name: '绥化市' },
      { code: '2327', name: '大兴安岭地区' }
    ]
  },
  {
    code: '45',
    name: '广西壮族自治区',
    cities: [
      { code: '4501', name: '南宁市' },
      { code: '4502', name: '柳州市' },
      { code: '4503', name: '桂林市' },
      { code: '4504', name: '梧州市' },
      { code: '4505', name: '北海市' },
      { code: '4506', name: '防城港市' },
      { code: '4507', name: '钦州市' },
      { code: '4508', name: '贵港市' },
      { code: '4509', name: '玉林市' },
      { code: '4510', name: '百色市' },
      { code: '4511', name: '贺州市' },
      { code: '4512', name: '河池市' },
      { code: '4513', name: '来宾市' },
      { code: '4514', name: '崇左市' }
    ]
  },
  {
    code: '46',
    name: '海南省',
    cities: [
      { code: '4601', name: '海口市' },
      { code: '4602', name: '三亚市' },
      { code: '4603', name: '三沙市' },
      { code: '4604', name: '儋州市' },
      { code: '4690', name: '省直辖县级行政区' }
    ]
  },
  {
    code: '50',
    name: '重庆市',
    cities: [
      { code: '5001', name: '万州区' },
      { code: '5002', name: '涪陵区' },
      { code: '5003', name: '渝中区' },
      { code: '5004', name: '大渡口区' },
      { code: '5005', name: '江北区' },
      { code: '5006', name: '沙坪坝区' },
      { code: '5007', name: '九龙坡区' },
      { code: '5008', name: '南岸区' },
      { code: '5009', name: '北碚区' },
      { code: '5010', name: '綦江区' },
      { code: '5011', name: '大足区' },
      { code: '5012', name: '渝北区' },
      { code: '5013', name: '巴南区' },
      { code: '5014', name: '黔江区' },
      { code: '5015', name: '长寿区' },
      { code: '5016', name: '江津区' },
      { code: '5017', name: '合川区' },
      { code: '5018', name: '永川区' },
      { code: '5019', name: '南川区' },
      { code: '5020', name: '璧山区' },
      { code: '5021', name: '铜梁区' },
      { code: '5022', name: '潼南区' },
      { code: '5023', name: '荣昌区' },
      { code: '5024', name: '开州区' },
      { code: '5025', name: '梁平区' },
      { code: '5026', name: '武隆区' }
    ]
  },
  {
    code: '51',
    name: '四川省',
    cities: [
      { code: '5101', name: '成都市' },
      { code: '5103', name: '自贡市' },
      { code: '5104', name: '攀枝花市' },
      { code: '5105', name: '泸州市' },
      { code: '5106', name: '德阳市' },
      { code: '5107', name: '绵阳市' },
      { code: '5108', name: '广元市' },
      { code: '5109', name: '遂宁市' },
      { code: '5110', name: '内江市' },
      { code: '5111', name: '乐山市' },
      { code: '5113', name: '南充市' },
      { code: '5114', name: '眉山市' },
      { code: '5115', name: '宜宾市' },
      { code: '5116', name: '广安市' },
      { code: '5117', name: '达州市' },
      { code: '5118', name: '雅安市' },
      { code: '5119', name: '巴中市' },
      { code: '5120', name: '资阳市' },
      { code: '5132', name: '阿坝藏族羌族自治州' },
      { code: '5133', name: '甘孜藏族自治州' },
      { code: '5134', name: '凉山彝族自治州' }
    ]
  },
  {
    code: '52',
    name: '贵州省',
    cities: [
      { code: '5201', name: '贵阳市' },
      { code: '5202', name: '六盘水市' },
      { code: '5203', name: '遵义市' },
      { code: '5204', name: '安顺市' },
      { code: '5205', name: '毕节市' },
      { code: '5206', name: '铜仁市' },
      { code: '5223', name: '黔西南布依族苗族自治州' },
      { code: '5226', name: '黔东南苗族侗族自治州' },
      { code: '5227', name: '黔南布依族苗族自治州' }
    ]
  },
  {
    code: '53',
    name: '云南省',
    cities: [
      { code: '5301', name: '昆明市' },
      { code: '5303', name: '曲靖市' },
      { code: '5304', name: '玉溪市' },
      { code: '5305', name: '保山市' },
      { code: '5306', name: '昭通市' },
      { code: '5307', name: '丽江市' },
      { code: '5308', name: '普洱市' },
      { code: '5309', name: '临沧市' },
      { code: '5323', name: '楚雄彝族自治州' },
      { code: '5325', name: '红河哈尼族彝族自治州' },
      { code: '5326', name: '文山壮族苗族自治州' },
      { code: '5328', name: '西双版纳傣族自治州' },
      { code: '5329', name: '大理白族自治州' },
      { code: '5331', name: '德宏傣族景颇族自治州' },
      { code: '5333', name: '怒江傈僳族自治州' },
      { code: '5334', name: '迪庆藏族自治州' }
    ]
  },
  {
    code: '54',
    name: '西藏自治区',
    cities: [
      { code: '5401', name: '拉萨市' },
      { code: '5402', name: '日喀则市' },
      { code: '5403', name: '昌都市' },
      { code: '5404', name: '林芝市' },
      { code: '5405', name: '山南市' },
      { code: '5406', name: '那曲市' },
      { code: '5425', name: '阿里地区' }
    ]
  },
  {
    code: '61',
    name: '陕西省',
    cities: [
      { code: '6101', name: '西安市' },
      { code: '6102', name: '铜川市' },
      { code: '6103', name: '宝鸡市' },
      { code: '6104', name: '咸阳市' },
      { code: '6105', name: '渭南市' },
      { code: '6106', name: '延安市' },
      { code: '6107', name: '汉中市' },
      { code: '6108', name: '榆林市' },
      { code: '6109', name: '安康市' },
      { code: '6110', name: '商洛市' }
    ]
  },
  {
    code: '62',
    name: '甘肃省',
    cities: [
      { code: '6201', name: '兰州市' },
      { code: '6202', name: '嘉峪关市' },
      { code: '6203', name: '金昌市' },
      { code: '6204', name: '白银市' },
      { code: '6205', name: '天水市' },
      { code: '6206', name: '武威市' },
      { code: '6207', name: '张掖市' },
      { code: '6208', name: '平凉市' },
      { code: '6209', name: '酒泉市' },
      { code: '6210', name: '庆阳市' },
      { code: '6211', name: '定西市' },
      { code: '6212', name: '陇南市' },
      { code: '6229', name: '临夏回族自治州' },
      { code: '6230', name: '甘南藏族自治州' }
    ]
  },
  {
    code: '63',
    name: '青海省',
    cities: [
      { code: '6301', name: '西宁市' },
      { code: '6302', name: '海东市' },
      { code: '6322', name: '海北藏族自治州' },
      { code: '6323', name: '黄南藏族自治州' },
      { code: '6325', name: '海南藏族自治州' },
      { code: '6326', name: '果洛藏族自治州' },
      { code: '6327', name: '玉树藏族自治州' },
      { code: '6328', name: '海西蒙古族藏族自治州' }
    ]
  },
  {
    code: '64',
    name: '宁夏回族自治区',
    cities: [
      { code: '6401', name: '银川市' },
      { code: '6402', name: '石嘴山市' },
      { code: '6403', name: '吴忠市' },
      { code: '6404', name: '固原市' },
      { code: '6405', name: '中卫市' }
    ]
  },
  {
    code: '65',
    name: '新疆维吾尔自治区',
    cities: [
      { code: '6501', name: '乌鲁木齐市' },
      { code: '6502', name: '克拉玛依市' },
      { code: '6504', name: '吐鲁番市' },
      { code: '6505', name: '哈密市' },
      { code: '6523', name: '昌吉回族自治州' },
      { code: '6527', name: '博尔塔拉蒙古自治州' },
      { code: '6528', name: '巴音郭楞蒙古自治州' },
      { code: '6529', name: '阿克苏地区' },
      { code: '6530', name: '克孜勒苏柯尔克孜自治州' },
      { code: '6531', name: '喀什地区' },
      { code: '6532', name: '和田地区' },
      { code: '6540', name: '伊犁哈萨克自治州' },
      { code: '6542', name: '塔城地区' },
      { code: '6543', name: '阿勒泰地区' }
    ]
  },
  {
    code: '71',
    name: '台湾省',
    cities: [
      { code: '7101', name: '台北市' },
      { code: '7102', name: '高雄市' },
      { code: '7103', name: '新北市' },
      { code: '7104', name: '台中市' },
      { code: '7105', name: '台南市' },
      { code: '7106', name: '桃园市' }
    ]
  },
  {
    code: '81',
    name: '香港特别行政区',
    cities: [
      { code: '8101', name: '中西区' },
      { code: '8102', name: '湾仔区' },
      { code: '8103', name: '东区' },
      { code: '8104', name: '南区' },
      { code: '8105', name: '油尖旺区' },
      { code: '8106', name: '深水埗区' },
      { code: '8107', name: '九龙城区' },
      { code: '8108', name: '黄大仙区' },
      { code: '8109', name: '观塘区' },
      { code: '8110', name: '荃湾区' },
      { code: '8111', name: '屯门区' },
      { code: '8112', name: '元朗区' },
      { code: '8113', name: '北区' },
      { code: '8114', name: '大埔区' },
      { code: '8115', name: '西贡区' },
      { code: '8116', name: '沙田区' },
      { code: '8117', name: '葵青区' },
      { code: '8118', name: '离岛区' }
    ]
  },
  {
    code: '82',
    name: '澳门特别行政区',
    cities: [
      { code: '8201', name: '花地玛堂区' },
      { code: '8202', name: '圣安多尼堂区' },
      { code: '8203', name: '大堂区' },
      { code: '8204', name: '望德堂区' },
      { code: '8205', name: '风顺堂区' },
      { code: '8206', name: '嘉模堂区' },
      { code: '8207', name: '圣方济各堂区' },
      { code: '8208', name: '路氹填海区' }
    ]
  }
])

// 选中的省份和城市
const selectedProvince = ref('')
const selectedCity = ref('')

// 根据省份筛选城市
const cities = computed(() => {
  if (!selectedProvince.value) return []
  const province = provinces.value.find(p => p.code === selectedProvince.value)
  return province ? province.cities : []
})

// 处理省份变化
const handleProvinceChange = () => {
  selectedCity.value = ''
  emitChange()
}

// 处理城市变化
const handleCityChange = () => {
  emitChange()
}

// 发送变化事件
const emitChange = () => {
  const value = {
    province: selectedProvince.value,
    city: selectedCity.value
  }
  emit('update:modelValue', value)
  emit('change', value)
}

// 监听外部传入的值变化
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    selectedProvince.value = newValue.province || ''
    selectedCity.value = newValue.city || ''
  }
}, { immediate: true })

// 获取省份名称
const getProvinceName = (provinceCode: string) => {
  const province = provinces.value.find(p => p.code === provinceCode)
  return province ? province.name : ''
}

// 暴露方法给父组件
defineExpose({
  getProvinceName,
  reset: () => {
    selectedProvince.value = ''
    selectedCity.value = ''
  }
})
</script>

<style lang="scss" scoped>
.city-selector {
  display: flex;
  gap: 16px;
  align-items: flex-start;

  .form-group {
    flex: 1;
    margin-bottom: 0;

    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #374151;
      font-size: 14px;

      .required {
        color: #ef4444;
      }
    }

    .form-control {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      background: white;
      box-sizing: border-box;
      cursor: pointer;

      &:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      &:disabled {
        background: #f9fafb;
        color: #6b7280;
        cursor: not-allowed;
      }

      &.is-invalid {
        border-color: #ef4444;
      }

      &::placeholder {
        color: #9ca3af;
      }
    }

    select.form-control {
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
      background-position: right 12px center;
      background-repeat: no-repeat;
      background-size: 16px;
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      padding-right: 40px;
    }

    .invalid-feedback {
      color: #ef4444;
      font-size: 12px;
      margin-top: 4px;
    }
  }
}

// 移动端适配
@media (max-width: 768px) {
  .city-selector {
    flex-direction: column;
    gap: 12px;
  }
}
</style>