import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Welcome from "./pages/Welcome";
import Index from "./pages/Index";
import XOGame from "./pages/XOGame";
import ChessGame from "./pages/ChessGame";
import LudoGame from "./pages/LudoGame";
import LobbyTest from "./pages/LobbyTest";
import TournamentPage from "./pages/TournamentPage";
import LocalTournament from "./pages/LocalTournament";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/home" element={<Index />} />
            <Route path="/xo" element={<XOGame />} />
            <Route path="/chess" element={<ChessGame />} />
            <Route path="/ludo" element={<LudoGame />} />
            <Route path="/lobby-test" element={<LobbyTest />} />
            <Route path="/tournament" element={<TournamentPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
