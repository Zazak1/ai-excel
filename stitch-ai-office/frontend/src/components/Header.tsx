import React from 'react';

const Header = () => {
    return (
        <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200">
            <div className="flex items-center flex-1 max-w-xl">
                <div className="relative w-full">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                    <input
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-slate-400 focus:bg-white transition-colors"
                        placeholder="搜索文件、报告或 AI 洞察..."
                        type="text"
                    />
                </div>
            </div>
            <div className="flex items-center gap-4">
                <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg relative transition-colors">
                    <span className="material-symbols-outlined">notifications</span>
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>
                <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
                <div className="flex items-center gap-3 pl-2 cursor-pointer group">
                    <div className="text-right">
                        <p className="text-sm font-bold text-slate-800">Alex Carter</p>
                        <p className="text-[11px] text-slate-500">企业版会员</p>
                    </div>
                    <div
                        className="size-10 rounded-full bg-cover bg-center border-2 border-slate-100 group-hover:border-primary transition-all"
                        style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCs4aTCxyp9u1z5E5c7hY_1MaLsLFfADxG_OFfTvU-cD6o6EobKEo6gcNbudgyuYZApFQArExUHqsAxHoeb3d4_psrJ73BElf38iiCd43tY0qa2JM_MXdG2qqDelTOgKKbYs9tqEyHqcVGRZltWeDhsGuXgzFhKo555Ixc8iyKo7z-rgYpAacilHT0TwLuiIaRDbPFoEjTMzJbNvdPx-jWqhisDU-IChDQKeZvb_Ybg_F5UH6dWZA4Bvw5Xj8jKb4bd8CZOLZdmoPE")' }}
                    ></div>
                </div>
            </div>
        </header>
    );
};

export default Header;
