import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';

const AlertDashboard = () => {
  // 定义严重程度类别的映射（英文代码 -> 中文标签）
  const categoryLabels = {
    Critical: '危急',
    Pending: '待处理',
    'Severe Delay': '严重延误',
  };
  // 定义每种类别对应的样式（文字颜色和背景色）
  const categoryStyles = {
    Critical: 'text-red-600 bg-red-100',
    Pending: 'text-yellow-600 bg-yellow-100',
    'Severe Delay': 'text-orange-600 bg-orange-100',
  };

  // 初始警报数据列表（mock 数据）
  const initialAlerts = [
    {
      id: 1001,
      patientName: '张三',
      patientId: 'A1001',
      category: 'Critical', // 危急警报
      findings: '出现严重心律不齐症状',
      delayDays: 2,
      status: 'Fail', // 通知状态：失败
    },
    {
      id: 1002,
      patientName: '李四',
      patientId: 'A1002',
      category: 'Critical', // 危急警报
      findings: '血压持续升高，疑似危险',
      delayDays: 7,
      status: 'Success', // 通知状态：成功
    },
    {
      id: 2001,
      patientName: '王五',
      patientId: 'B2001',
      category: 'Severe Delay', // 严重延误警报（非危急但延误超阈值）
      findings: '随访复查延误，患者伤口恢复不佳',
      delayDays: 10,
      status: 'Fail',
    },
    {
      id: 2002,
      patientName: '赵六',
      patientId: 'B2002',
      category: 'Pending', // 待处理警报
      findings: '常规检查异常，等待医生审核',
      delayDays: 3,
      status: 'Fail',
    },
    {
      id: 3001,
      patientName: '钱七',
      patientId: 'C3001',
      category: 'Severe Delay', // 严重延误警报
      findings: '报告发送后未跟进，患者情况不明',
      delayDays: 8,
      status: 'Success',
    },
    {
      id: 3002,
      patientName: '孙八',
      patientId: 'C3002',
      category: 'Pending', // 待处理警报
      findings: '患者轻微不适，建议复查',
      delayDays: 1,
      status: 'Success',
    },
  ];

  // 状态：警报列表和当前筛选分类
  const [alerts, setAlerts] = useState(initialAlerts);
  const [filter, setFilter] = useState('All');

  // 计算统计数据
  const totalAlerts = alerts.length;
  const totalCritical = alerts.filter(a => a.category === 'Critical').length;
  const totalDelay = alerts.reduce((sum, a) => sum + a.delayDays, 0);
  const avgDelay = totalAlerts > 0 ? Math.round(totalDelay / totalAlerts) : 0;
  const successCount = alerts.filter(a => a.status === 'Success').length;
  const successRate =
    totalAlerts > 0 ? Math.round((successCount / totalAlerts) * 100) : 0;

  // 根据当前筛选状态过滤警报列表
  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'All') return true;
    if (filter === 'Critical') return alert.category === 'Critical';
    if (filter === 'Pending') return alert.category === 'Pending';
    if (filter === 'Severe Delay') return alert.category === 'Severe Delay';
    return true;
  });

  // 准备柱状图数据：统计各类别数量
  const counts = { Critical: 0, Pending: 0, 'Severe Delay': 0 };
  alerts.forEach(a => {
    counts[a.category] = (counts[a.category] || 0) + 1;
  });
  const barData = [
    { name: '危急', count: counts['Critical'] },
    { name: '严重延误', count: counts['Severe Delay'] },
    { name: '待处理', count: counts['Pending'] },
  ];
  // 准备折线图数据：模拟最近6个月的通知成功率趋势
  const lineData = [
    { month: '1月', rate: 60 },
    { month: '2月', rate: 72 },
    { month: '3月', rate: 65 },
    { month: '4月', rate: 80 },
    { month: '5月', rate: 78 },
    { month: '6月', rate: 90 },
  ];

  // 操作处理函数
  const handleResend = id => {
    console.log(`Resending alert ${id}...`);
    // 模拟重新通知动作，可在此触发实际通知逻辑
  };
  const handleViewDetails = id => {
    console.log(`View details of alert ${id} (跳转到 /alert/${id})`);
    // 在实际应用中这里会使用路由导航，例如 useNavigate('/alert/'+id)
    // 本示例中仅打印日志
  };
  const handleResolve = id => {
    console.log(`Mark alert ${id} as resolved`);
    // 从列表状态中移除该警报项
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  return (
    <div className='bg-gray-100 min-h-screen p-4'>
      {/* 页面标题 */}
      <h1 className='text-2xl font-bold mb-4'>警报仪表板</h1>

      {/* 统计概览卡片 */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
        <div className='bg-white shadow rounded-lg p-4'>
          <div className='text-sm text-gray-500'>活跃警报数</div>
          <div className='text-2xl font-semibold'>{totalAlerts}</div>
        </div>
        <div className='bg-white shadow rounded-lg p-4'>
          <div className='text-sm text-gray-500'>危急案例数</div>
          <div className='text-2xl font-semibold'>{totalCritical}</div>
        </div>
        <div className='bg-white shadow rounded-lg p-4'>
          <div className='text-sm text-gray-500'>平均延误时间 (天)</div>
          <div className='text-2xl font-semibold'>{avgDelay}</div>
        </div>
        <div className='bg-white shadow rounded-lg p-4'>
          <div className='text-sm text-gray-500'>通知成功率</div>
          <div className='text-2xl font-semibold'>{successRate}%</div>
        </div>
      </div>

      {/* 图表区域：柱状图和折线图 */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-8'>
        {/* 警报数量柱状图卡片 */}
        <div className='bg-white shadow rounded-lg p-4'>
          <h3 className='font-semibold mb-2'>按严重程度分类的警报数量</h3>
          <div className='w-full h-64'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={barData}>
                <XAxis dataKey='name' />
                <YAxis allowDecimals={false} />
                {/* 整数刻度 */}
                <Tooltip />
                <Bar dataKey='count' fill='#3182ce' />
                {/* 蓝色柱子 */}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* 通知成功率折线图卡片 */}
        <div className='bg-white shadow rounded-lg p-4'>
          <h3 className='font-semibold mb-2'>通知成功率趋势</h3>
          <div className='w-full h-64'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={lineData}>
                <XAxis dataKey='month' />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={v => `${v}%`} />
                <Line
                  type='monotone'
                  dataKey='rate'
                  stroke='#4a90e2'
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 筛选器按钮组 */}
      <div className='flex flex-wrap items-center mb-4'>
        {['All', 'Critical', 'Pending', 'Severe Delay'].map(key => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 mr-2 mb-2 rounded ${
              filter === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800'
            }`}
          >
            {/* 按钮显示中文标签 */}
            {key === 'All' ? '全部' : categoryLabels[key]}
          </button>
        ))}
      </div>

      {/* 警报列表表格 */}
      <div className='bg-white shadow rounded-lg overflow-x-auto'>
        <table className='min-w-full text-sm text-left text-gray-800'>
          <thead className='bg-gray-100 text-gray-600 uppercase text-xs'>
            <tr>
              <th className='px-4 py-2'>患者</th>
              <th className='px-4 py-2'>严重程度</th>
              <th className='px-4 py-2'>医疗发现摘要</th>
              <th className='px-4 py-2'>延误天数</th>
              <th className='px-4 py-2'>通知状态</th>
              <th className='px-4 py-2'>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredAlerts.map(alert => (
              <tr key={alert.id} className='border-b'>
                <td className='px-4 py-2'>
                  {alert.patientName} (ID: {alert.patientId})
                </td>
                <td className='px-4 py-2'>
                  <span
                    className={`px-2 py-1 rounded font-bold ${
                      categoryStyles[alert.category]
                    }`}
                  >
                    {categoryLabels[alert.category]}
                  </span>
                </td>
                <td className='px-4 py-2'>{alert.findings}</td>
                <td className='px-4 py-2'>{alert.delayDays}天</td>
                <td className='px-4 py-2'>
                  {alert.status === 'Success' ? (
                    <span className='text-green-600 font-medium'>成功</span>
                  ) : (
                    <span className='text-red-600 font-medium'>失败</span>
                  )}
                </td>
                <td className='px-4 py-2 space-x-2'>
                  <button
                    onClick={() => handleResend(alert.id)}
                    className='text-blue-600 hover:underline'
                  >
                    📞 重新通知
                  </button>
                  <button
                    onClick={() => handleViewDetails(alert.id)}
                    className='text-blue-600 hover:underline'
                  >
                    📄 查看详情
                  </button>
                  <button
                    onClick={() => handleResolve(alert.id)}
                    className='text-blue-600 hover:underline'
                  >
                    ✅ 标记已解决
                  </button>
                </td>
              </tr>
            ))}
            {filteredAlerts.length === 0 && (
              <tr>
                <td colSpan='6' className='px-4 py-4 text-center text-gray-500'>
                  无警报数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AlertDashboard;