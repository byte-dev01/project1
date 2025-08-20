import React, { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { 
  Calendar, Users, Stethoscope, DollarSign, TrendingUp, 
  Clock, Heart, Activity, AlertCircle, UserPlus, 
  Phone, Mail, ChevronRight, Search, Bell, Settings,
  FileText, Hospital, Pill, UserCheck
} from 'lucide-react';

export default function ModernMedicalDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  
  // 模拟数据
  const stats = {
    appointments: { value: 250, change: 50, trend: 'up' },
    newPatients: { value: 150, change: 30, trend: 'up' },
    operations: { value: 50, change: -30, trend: 'down' },
    earnings: { value: 25100, change: 30, trend: 'up' }
  };

  // 性别分布数据
  const genderData = [
    { month: 'Jan', male: 55, female: 45 },
    { month: 'Feb', male: 48, female: 52 },
    { month: 'Mar', male: 60, female: 40 },
    { month: 'Apr', male: 52, female: 48 },
    { month: 'May', male: 58, female: 42 },
    { month: 'Jun', male: 45, female: 55 },
    { month: 'Jul', male: 50, female: 50 },
    { month: 'Aug', male: 53, female: 47 },
    { month: 'Sep', male: 49, female: 51 },
    { month: 'Oct', male: 56, female: 44 },
    { month: 'Nov', male: 51, female: 49 },
    { month: 'Dec', male: 54, female: 46 }
  ];

  // 科室分布数据
  const departmentData = [
    { name: 'Neurology', value: 30, color: '#3b82f6' },
    { name: 'Dental Care', value: 25, color: '#10b981' },
    { name: 'Gynecology', value: 20, color: '#f59e0b' },
    { name: 'Orthopedic', value: 15, color: '#ef4444' },
    { name: 'Cardiology', value: 10, color: '#8b5cf6' }
  ];

  // 收入数据
  const revenueData = [
    { day: 'Mon', income: 32485, expense: 12458 },
    { day: 'Tue', income: 28654, expense: 10254 },
    { day: 'Wed', income: 35874, expense: 13658 },
    { day: 'Thu', income: 31254, expense: 11458 },
    { day: 'Fri', income: 38745, expense: 14587 },
    { day: 'Sat', income: 25478, expense: 8547 },
    { day: 'Sun', income: 18547, expense: 6587 }
  ];

  // 预约列表
  const appointments = [
    {
      id: 1,
      patient: 'Shawn Hampton',
      type: 'Emergency appointment',
      time: '10:00',
      date: 'Today',
      price: 30,
      doctor: 'Dr. Smith',
      status: 'confirmed'
    },
    {
      id: 2,
      patient: 'Polly Paul',
      type: 'USG + Consultation',
      time: '10:30',
      date: 'Today',
      price: 50,
      doctor: 'Dr. Johnson',
      status: 'confirmed'
    },
    {
      id: 3,
      patient: 'Johen Doe',
      type: 'Laboratory screening',
      time: '11:00',
      date: 'Today',
      price: 70,
      doctor: 'Dr. Williams',
      status: 'pending'
    },
    {
      id: 4,
      patient: 'Harmani Doe',
      type: 'Keeping pregnant',
      time: '11:30',
      date: 'Today',
      price: 85,
      doctor: 'Dr. Brown',
      status: 'confirmed'
    }
  ];

  // 医生列表
  const doctors = [
    { id: 1, name: 'Dr. Jaylon Stanton', specialty: 'Dentist', patients: 125, rating: 4.8 },
    { id: 2, name: 'Dr. Carla Schleifer', specialty: 'Cardiologist', patients: 98, rating: 4.9 },
    { id: 3, name: 'Dr. Maria Rodriguez', specialty: 'Neurologist', patients: 156, rating: 4.7 },
    { id: 4, name: 'Dr. James Chen', specialty: 'Orthopedic', patients: 87, rating: 4.8 }
  ];

  // 支付历史
  const paymentHistory = [
    { id: 1, doctor: 'Dr. Johen Doe', treatment: 'Kidney function test', amount: 25.15, date: 'Sunday, 16 May' },
    { id: 2, doctor: 'Dr. Michael Doe', treatment: 'Emergency appointment', amount: 99.15, date: 'Sunday, 16 May' },
    { id: 3, doctor: 'Dr. Barrie Maxwell', treatment: 'Complementation test', amount: 40.45, date: 'Sunday, 16 May' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Good Morning, David Smith</h1>
              <p className="text-sm text-gray-500">Have a nice day at work</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search"
                  className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-lg relative">
                <Bell className="w-6 h-6 text-gray-600" />
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <Settings className="w-6 h-6 text-gray-600" />
              </button>
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                DS
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            icon={<Calendar className="w-6 h-6" />}
            title="Appointments"
            value={stats.appointments.value}
            change={stats.appointments.change}
            trend={stats.appointments.trend}
            bgColor="bg-blue-50"
            iconColor="text-blue-600"
          />
          <StatsCard
            icon={<UserPlus className="w-6 h-6" />}
            title="New Patients"
            value={stats.newPatients.value}
            change={stats.newPatients.change}
            trend={stats.newPatients.trend}
            bgColor="bg-green-50"
            iconColor="text-green-600"
          />
          <StatsCard
            icon={<Stethoscope className="w-6 h-6" />}
            title="Operations"
            value={stats.operations.value}
            change={stats.operations.change}
            trend={stats.operations.trend}
            bgColor="bg-orange-50"
            iconColor="text-orange-600"
          />
          <StatsCard
            icon={<DollarSign className="w-6 h-6" />}
            title="Earnings"
            value={`$${stats.earnings.value.toLocaleString()}`}
            change={stats.earnings.change}
            trend={stats.earnings.trend}
            bgColor="bg-purple-50"
            iconColor="text-purple-600"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Patient Visit by Gender */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Patient Visit by Gender</h3>
              <select className="text-sm border rounded-lg px-3 py-1">
                <option>2025</option>
                <option>2024</option>
              </select>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={genderData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="male" fill="#3b82f6" name="Male" />
                <Bar dataKey="female" fill="#ec4899" name="Female" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 flex items-center justify-center space-x-8">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-sm">Male 70%</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-pink-500 rounded-full mr-2"></div>
                <span className="text-sm">Female 30%</span>
              </div>
            </div>
          </div>

          {/* Patient by Department */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-6">Patient by Department</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={departmentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {departmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {departmentData.map((dept, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: dept.color }}
                    ></div>
                    <span>{dept.name}</span>
                  </div>
                  <span className="font-medium">{dept.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily Revenue Report */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Daily Revenue Report</h3>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
            <div className="mb-4">
              <div className="text-3xl font-bold text-green-600">$32,485</div>
              <div className="text-sm text-gray-500">$12,458 expense</div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueData}>
                <XAxis dataKey="day" />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="income" fill="#3b82f6" />
                <Bar dataKey="expense" fill="#e5e7eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Payments History */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Payments history</h3>
              <button className="text-sm text-blue-600 hover:underline">View all</button>
            </div>
            <div className="space-y-4">
              {paymentHistory.map((payment) => (
                <div key={payment.id} className="border-b pb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{payment.doctor}</span>
                    <span className="text-lg font-semibold">${payment.amount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{payment.treatment}</span>
                    <button className="p-1 hover:bg-gray-100 rounded">
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{payment.date}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Appointments */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Upcoming Appointments</h3>
              <div className="flex space-x-2">
                <button className="px-3 py-1 bg-blue-500 text-white text-sm rounded">Today</button>
                <button className="px-3 py-1 text-gray-600 text-sm hover:bg-gray-100 rounded">Week</button>
                <button className="px-3 py-1 text-gray-600 text-sm hover:bg-gray-100 rounded">Month</button>
              </div>
            </div>
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <div key={appointment.id} className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{appointment.patient}</p>
                      <p className="text-xs text-gray-500">{appointment.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">{appointment.time}</p>
                    <p className="text-sm font-medium">${appointment.price}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button className="p-1 hover:bg-green-50 rounded text-green-600">
                      <Phone className="w-4 h-4" />
                    </button>
                    <button className="p-1 hover:bg-gray-100 rounded">
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Doctor List */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Doctor List</h3>
            <button className="text-sm text-blue-600 hover:underline">View all</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {doctors.map((doctor) => (
              <div key={doctor.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <UserCheck className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">{doctor.name}</p>
                    <p className="text-sm text-gray-500">{doctor.specialty}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{doctor.patients} patients</span>
                  <div className="flex items-center">
                    <span className="text-yellow-500">★</span>
                    <span className="ml-1">{doctor.rating}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Stats Card Component
function StatsCard({ icon, title, value, change, trend, bgColor, iconColor }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${bgColor}`}>
          <div className={iconColor}>{icon}</div>
        </div>
        <div className={`text-sm font-medium flex items-center ${
          trend === 'up' ? 'text-green-600' : 'text-red-600'
        }`}>
          {trend === 'up' ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingUp className="w-4 h-4 mr-1 rotate-180" />}
          {change}%
        </div>
      </div>
      <h3 className="text-sm text-gray-500 mb-1">{title}</h3>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-2">vs last month</p>
    </div>
  );
}