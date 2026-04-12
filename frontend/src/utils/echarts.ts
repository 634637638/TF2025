/**
 * ECharts 按需引入工具
 * 优化构建体积：仅引入使用的图表类型和组件
 * 从 1.1M 减少到约 300K
 */
import * as echarts from 'echarts/core'

// 按需引入图表类型
import {
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  GaugeChart
} from 'echarts/charts'

// 按需引入组件
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  ToolboxComponent,
  DataZoomComponent,
  VisualMapComponent,
  GraphicComponent
} from 'echarts/components'

// 按需引入渲染器
import { CanvasRenderer } from 'echarts/renderers'

// 注册必需组件
echarts.use([
  // 图表类型
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  GaugeChart,
  // 组件
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  ToolboxComponent,
  DataZoomComponent,
  VisualMapComponent,
  GraphicComponent,
  // 渲染器
  CanvasRenderer
])

export default echarts

// 导出常用类型供 TypeScript 使用
export type { EChartsCoreOption } from 'echarts/core'
export type { EChartsType as ECharts } from 'echarts/core'

// 重新导出 echarts 的主要类型
export type { EChartsOption } from 'echarts'
