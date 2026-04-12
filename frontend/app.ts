import { createApp, ref, onMounted } from 'vue';
import { unifiedApi } from './src/utils/unified-api';

const API_BASE = 'http://localhost:3000/api';

interface DataItem {
  id: number;
  name: string;
  description: string;
  created_at?: string;
}

const App = {
  setup() {
    // 响应式数据
    const dataList = ref<DataItem[]>([]);
    const nameInput = ref('');
    const descriptionInput = ref('');
    const editingId = ref<number | null>(null);
    const editingName = ref('');
    const editingDescription = ref('');
    const loading = ref(false);
    const dbStatus = ref<{connected: boolean, message?: string}>({connected: false});

    // 加载数据
    const loadData = async () => {
      loading.value = true;
      try {
        const response = await unifiedApi.get<DataItem[]>('/data');
        dataList.value = response.data;
      } catch (error) {
        console.error('加载数据失败:', error);
        alert('加载数据失败: ' + (error as Error).message);
      } finally {
        loading.value = false;
      }
    };

    // 添加数据
    const addData = async () => {
      if (!nameInput.value || !descriptionInput.value) {
        alert('请填写完整信息');
        return;
      }

      loading.value = true;
      try {
        const response = await unifiedApi.post<DataItem>('/data', {
          name: nameInput.value,
          description: descriptionInput.value
        });

        dataList.value.push(response.data);
        nameInput.value = '';
        descriptionInput.value = '';
      } catch (error) {
        console.error('添加数据失败:', error);
        alert('添加数据失败: ' + (error as Error).message);
      } finally {
        loading.value = false;
      }
    };

    // 删除数据
    const deleteData = async (id: number) => {
      if (!confirm('确定要删除这条数据吗？')) return;

      loading.value = true;
      try {
        await unifiedApi.delete(`/data/${id}`);
        dataList.value = dataList.value.filter(item => item.id !== id);
      } catch (error) {
        console.error('删除数据失败:', error);
        alert('删除数据失败: ' + (error as Error).message);
      } finally {
        loading.value = false;
      }
    };

    // 开始编辑
    const startEditing = (item: DataItem) => {
      editingId.value = item.id;
      editingName.value = item.name;
      editingDescription.value = item.description;
    };

    // 保存编辑
    const saveEditing = async () => {
      if (editingId.value === null) return;

      loading.value = true;
      try {
        const response = await unifiedApi.put<DataItem>(`/data/${editingId.value}`, {
          name: editingName.value,
          description: editingDescription.value
        });

        const index = dataList.value.findIndex(item => item.id === editingId.value);
        if (index !== -1) {
          dataList.value[index] = response.data;
        }

        cancelEditing();
      } catch (error) {
        console.error('更新数据失败:', error);
        alert('更新数据失败: ' + (error as Error).message);
      } finally {
        loading.value = false;
      }
    };

    // 取消编辑
    const cancelEditing = () => {
      editingId.value = null;
      editingName.value = '';
      editingDescription.value = '';
    };

    // 测试数据库连接
    const testDbConnection = async () => {
      loading.value = true;
      try {
        const response = await unifiedApi.get('/test-db-connection');
        dbStatus.value = {connected: response.success, message: response.message};
        alert(response.message);
        // 如果连接成功，重新加载数据
        if (response.success) {
          loadData();
        }
      } catch (error: any) {
        dbStatus.value = {connected: false, message: error.response?.data?.message || error.message};
        alert(`数据库连接失败: ${error.response?.data?.message || error.message}`);
      } finally {
        loading.value = false;
      }
    };

    // 检查数据库状态
    const checkDbStatus = async () => {
      loading.value = true;
      try {
        const response = await unifiedApi.get('/db-status');
        const status = response.data;
        dbStatus.value = {connected: status.connected};
        alert(`数据库连接状态: ${status.connected ? '已连接' : '未连接'}\n主机: ${status.config.host}:${status.config.port}/${status.config.database}`);
      } catch (error: any) {
        dbStatus.value = {connected: false, message: error.message};
        alert(`检查数据库状态失败: ${error.message}`);
      } finally {
        loading.value = false;
      }
    };

    // 组件挂载时加载数据
    onMounted(() => {
      loadData();
    });

    return {
      // 数据
      dataList,
      nameInput,
      descriptionInput,
      editingId,
      editingName,
      editingDescription,
      loading,
      dbStatus,
      
      // 方法
      addData,
      deleteData,
      startEditing,
      saveEditing,
      cancelEditing,
      testDbConnection,
      checkDbStatus
    };
  }
};

// 创建并挂载应用
const app = createApp(App);
app.mount('#app');