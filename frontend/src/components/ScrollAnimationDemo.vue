<template>
  <div class="scroll-animation-demo">
    <div class="demo-section">
      <h2>滚动动画效果演示</h2>
      <p class="demo-intro">向下滚动查看各种动画效果</p>
    </div>

    <!-- 淡入效果 -->
    <section class="demo-section">
      <h3>淡入效果 (Fade)</h3>
      <div class="demo-grid">
        <div data-aos="fade-up" class="demo-card">
          <i class="fas fa-arrow-up"></i>
          <span>向上淡入</span>
        </div>
        <div data-aos="fade-down" class="demo-card">
          <i class="fas fa-arrow-down"></i>
          <span>向下淡入</span>
        </div>
        <div data-aos="fade-left" class="demo-card">
          <i class="fas fa-arrow-left"></i>
          <span>向左淡入</span>
        </div>
        <div data-aos="fade-right" class="demo-card">
          <i class="fas fa-arrow-right"></i>
          <span>向右淡入</span>
        </div>
        <div data-aos="fade-up-right" class="demo-card">
          <i class="fas fa-arrow-up-right"></i>
          <span>右上淡入</span>
        </div>
        <div data-aos="fade-up-left" class="demo-card">
          <i class="fas fa-arrow-up-left"></i>
          <span>左上淡入</span>
        </div>
      </div>
    </section>

    <!-- 翻转效果 -->
    <section class="demo-section">
      <h3>翻转效果 (Flip)</h3>
      <div class="demo-grid">
        <div data-aos="flip-left" class="demo-card">
          <i class="fas fa-undo"></i>
          <span>左翻转</span>
        </div>
        <div data-aos="flip-right" class="demo-card">
          <i class="fas fa-redo"></i>
          <span>右翻转</span>
        </div>
        <div data-aos="flip-up" class="demo-card">
          <i class="fas fa-arrow-up"></i>
          <span>上翻转</span>
        </div>
        <div data-aos="flip-down" class="demo-card">
          <i class="fas fa-arrow-down"></i>
          <span>下翻转</span>
        </div>
      </div>
    </section>

    <!-- 缩放效果 -->
    <section class="demo-section">
      <h3>缩放效果 (Zoom)</h3>
      <div class="demo-grid">
        <div data-aos="zoom-in" class="demo-card">
          <i class="fas fa-search-plus"></i>
          <span>放大进入</span>
        </div>
        <div data-aos="zoom-in-up" class="demo-card">
          <i class="fas fa-expand-alt"></i>
          <span>放大向上</span>
        </div>
        <div data-aos="zoom-in-down" class="demo-card">
          <i class="fas fa-compress-alt"></i>
          <span>放大向下</span>
        </div>
        <div data-aos="zoom-out" class="demo-card">
          <i class="fas fa-search-minus"></i>
          <span>缩小进入</span>
        </div>
      </div>
    </section>

    <!-- 滑动效果 -->
    <section class="demo-section">
      <h3>滑动效果 (Slide)</h3>
      <div class="demo-grid">
        <div data-aos="slide-up" class="demo-card">
          <i class="fas fa-arrow-up"></i>
          <span>向上滑动</span>
        </div>
        <div data-aos="slide-down" class="demo-card">
          <i class="fas fa-arrow-down"></i>
          <span>向下滑动</span>
        </div>
        <div data-aos="slide-left" class="demo-card">
          <i class="fas fa-arrow-left"></i>
          <span>向左滑动</span>
        </div>
        <div data-aos="slide-right" class="demo-card">
          <i class="fas fa-arrow-right"></i>
          <span>向右滑动</span>
        </div>
      </div>
    </section>

    <!-- 延迟动画示例 -->
    <section class="demo-section">
      <h3>延迟动画示例</h3>
      <p class="demo-intro">依次出现的列表项</p>
      <div class="demo-list">
        <div
          v-for="i in 6"
          :key="i"
          :data-aos="'fade-up'"
          :data-aos-delay="i * 100"
          class="demo-list-item"
        >
          <span class="item-number">{{ i }}</span>
          <span class="item-text">列表项 {{ i }}</span>
        </div>
      </div>
    </section>

    <!-- 持续时间示例 -->
    <section class="demo-section">
      <h3>动画持续时间</h3>
      <div class="demo-grid">
        <div data-aos="fade-up" data-aos-duration="500" class="demo-card">
          <i class="fas fa-bolt"></i>
          <span>快速 (500ms)</span>
        </div>
        <div data-aos="fade-up" data-aos-duration="1000" class="demo-card">
          <i class="fas fa-walking"></i>
          <span>正常 (1000ms)</span>
        </div>
        <div data-aos="fade-up" data-aos-duration="2000" class="demo-card">
          <i class="fas fa-snail"></i>
          <span>缓慢 (2000ms)</span>
        </div>
      </div>
    </section>

    <!-- 缓动函数示例 -->
    <section class="demo-section">
      <h3>缓动函数 (Easing)</h3>
      <div class="demo-grid">
        <div data-aos="fade-up" data-aos-easing="linear" class="demo-card">
          <span>Linear</span>
        </div>
        <div data-aos="fade-up" data-aos-easing="ease" class="demo-card">
          <span>Ease</span>
        </div>
        <div data-aos="fade-up" data-aos-easing="ease-in" class="demo-card">
          <span>Ease In</span>
        </div>
        <div data-aos="fade-up" data-aos-easing="ease-out" class="demo-card">
          <span>Ease Out</span>
        </div>
        <div data-aos="fade-up" data-aos-easing="ease-in-out" class="demo-card">
          <span>Ease In Out</span>
        </div>
        <div data-aos="fade-up" data-aos-easing="ease-out-cubic" class="demo-card">
          <span>Ease Out Cubic</span>
        </div>
      </div>
    </section>

    <!-- 锚点位置示例 -->
    <section class="demo-section">
      <h3>锚点位置 (Anchor Placement)</h3>
      <div class="demo-grid">
        <div
          data-aos="fade-up"
          data-aos-anchor-placement="top-bottom"
          class="demo-card"
        >
          <span>Top Bottom</span>
        </div>
        <div
          data-aos="fade-up"
          data-aos-anchor-placement="center-bottom"
          class="demo-card"
        >
          <span>Center Bottom</span>
        </div>
        <div
          data-aos="fade-up"
          data-aos-anchor-placement="bottom-bottom"
          class="demo-card"
        >
          <span>Bottom Bottom</span>
        </div>
      </div>
    </section>

    <!-- 实际应用示例 -->
    <section class="demo-section">
      <h3>实际应用示例 - 统计卡片</h3>
      <div class="stats-example">
        <div
          v-for="(stat, index) in stats"
          :key="index"
          :data-aos="'fade-up'"
          :data-aos-delay="index * 100"
          class="stat-card"
        >
          <div class="stat-icon" :style="{ background: stat.color }">
            <i :class="stat.icon"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="demo-section">
      <h3>实际应用示例 - 内容区块</h3>
      <div class="content-example">
        <div data-aos="fade-right" data-aos-delay="0" class="content-item">
          <div class="content-icon">
            <i class="fas fa-search"></i>
          </div>
          <h4>综合查询</h4>
          <p>支持多条件组合查询，快速定位所需数据</p>
        </div>
        <div data-aos="fade-right" data-aos-delay="200" class="content-item">
          <div class="content-icon">
            <i class="fas fa-chart-bar"></i>
          </div>
          <h4>数据统计</h4>
          <p>实时统计各项指标，数据可视化展示</p>
        </div>
        <div data-aos="fade-right" data-aos-delay="400" class="content-item">
          <div class="content-icon">
            <i class="fas fa-download"></i>
          </div>
          <h4>导出功能</h4>
          <p>支持 Excel 导出，方便数据分析和备份</p>
        </div>
      </div>
    </section>

    <div class="demo-footer">
      <p>✨ 滚动动画系统由 AOS 提供</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const stats = ref([
  {
    icon: 'fas fa-boxes',
    label: '总设备',
    value: '1,234',
    color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  {
    icon: 'fas fa-inventory',
    label: '在库',
    value: '856',
    color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  },
  {
    icon: 'fas fa-shopping-cart',
    label: '已售',
    value: '378',
    color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
  },
  {
    icon: 'fas fa-gem',
    label: '全新',
    value: '245',
    color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
  }
])
</script>

<style scoped lang="scss">
.scroll-animation-demo {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
}

.demo-section {
  margin-bottom: 80px;
}

.demo-section h2 {
  text-align: center;
  font-size: 2.5rem;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.demo-section h3 {
  text-align: center;
  font-size: 1.8rem;
  margin-bottom: 30px;
  color: #303133;
}

.demo-intro {
  text-align: center;
  color: #606266;
  font-size: 1.1rem;
  margin-bottom: 30px;
}

.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.demo-card {
  background: white;
  border-radius: 12px;
  padding: 30px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s, box-shadow 0.3s;
  cursor: pointer;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }

  i {
    font-size: 2.5rem;
    margin-bottom: 15px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  span {
    display: block;
    color: #606266;
    font-weight: 500;
  }
}

.demo-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-width: 600px;
  margin: 0 auto;
}

.demo-list-item {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: 20px;

  .item-number {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.2rem;
  }

  .item-text {
    flex: 1;
    color: #303133;
    font-weight: 500;
  }
}

.stats-example {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 25px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

  .stat-icon {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.5rem;
  }

  .stat-content {
    flex: 1;

    .stat-value {
      font-size: 1.8rem;
      font-weight: bold;
      color: #303133;
      margin-bottom: 5px;
    }

    .stat-label {
      color: #909399;
      font-size: 0.9rem;
    }
  }
}

.content-example {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 30px;
}

.content-item {
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  text-align: center;

  .content-icon {
    width: 70px;
    height: 70px;
    margin: 0 auto 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 2rem;
  }

  h4 {
    font-size: 1.3rem;
    margin-bottom: 15px;
    color: #303133;
  }

  p {
    color: #606266;
    line-height: 1.6;
  }
}

.demo-footer {
  text-align: center;
  padding: 40px 0;
  color: #909399;
  font-size: 1.1rem;

  p {
    margin: 0;
  }
}

/* 响应式 */
@media (max-width: 768px) {
  .scroll-animation-demo {
    padding: 20px 15px;
  }

  .demo-section h2 {
    font-size: 1.8rem;
  }

  .demo-section h3 {
    font-size: 1.4rem;
  }

  .demo-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
  }

  .stats-example {
    grid-template-columns: 1fr;
  }
}
</style>
