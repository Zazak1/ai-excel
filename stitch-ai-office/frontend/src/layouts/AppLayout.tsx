import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const AppLayout = () => {
    return (
        <div className="flex h-screen overflow-hidden bg-background-light">
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AppLayout;
