import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
    const navItems = [
        { name: '控制台', icon: 'grid_view', path: '/' },
        { name: 'AI 智能表格', icon: 'table_chart', path: '/spreadsheet' },
        { name: 'AI PPT 设计', icon: 'slideshow', path: '/ppt' },
        { name: '数据分析', icon: 'analytics', path: '/analytics' },
        { name: '深度报告', icon: 'description', path: '/report' },
    ];

    return (
        <aside className="w-64 flex-shrink-0 flex flex-col bg-surface border-r border-slate-200 h-screen">
            <div className="p-6 flex items-center gap-3">
                <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-md shadow-blue-200">
                    <span className="material-symbols-outlined">auto_awesome</span>
                </div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">AI 办公套件</h2>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-1 custom-scrollbar overflow-y-auto">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer group ${isActive
                                ? 'bg-blue-50 text-primary border border-blue-100'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`
                        }
                    >
                        <span className={`material-symbols-outlined ${!isActive ? 'group-hover:text-primary transition-colors' : ''}`}>
                            {item.icon}
                        </span>
                        <p className="text-sm font-medium">{item.name}</p>
                    </NavLink>
                ))}

                <div className="pt-8 pb-2">
                    <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">账户</p>
                </div>

                <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer">
                    <span className="material-symbols-outlined">settings</span>
                    <p className="text-sm font-medium">设置</p>
                </div>
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer">
                    <span className="material-symbols-outlined">help</span>
                    <p className="text-sm font-medium">帮助中心</p>
                </div>
            </nav>

            <div className="p-4 mt-auto border-t border-slate-100">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-slate-800">专业版</p>
                        <span className="text-[10px] font-bold text-primary bg-blue-50 px-1.5 py-0.5 rounded">PRO</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">本月已使用 75% AI 额度。</p>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-primary h-full w-3/4"></div>
                    </div>
                </div>
                <button className="w-full flex items-center justify-center gap-2 bg-primary text-white text-sm font-bold py-2.5 rounded-lg hover:bg-primary-dark transition-all shadow-md shadow-blue-200">
                    <span>升级套餐</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
