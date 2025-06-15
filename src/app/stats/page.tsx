
"use client";

import React, { useEffect, useState } from 'react';
import { useAppContext } from '@/providers/AppProvider';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import GlobalLoadingSpinner from '@/components/core/GlobalLoadingSpinner';

interface ReviewLog {
  cardId: string;
  deckId: string;
  rating: number;
  reviewedAt: Timestamp;
}

interface ChartData {
  name: string;
  reviews: number;
}

export default function StatsPage() {
  const { firestoreDb, userId, appIdPathSegment, loadingAuth } = useAppContext();
  const { toast } = useToast();

  const [totalReviewedCount, setTotalReviewedCount] = useState(0);
  const [todayReviewedCount, setTodayReviewedCount] = useState(0);
  const [weeklyChartData, setWeeklyChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (loadingAuth || !userId) {
      if (!loadingAuth && !userId) setIsLoading(false);
      return;
    }

    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const reviewLogColRef = collection(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "reviewLog");
        const querySnapshot = await getDocs(reviewLogColRef);

        const allReviews: ReviewLog[] = [];
        querySnapshot.forEach(doc => {
          allReviews.push(doc.data() as ReviewLog);
        });

        setTotalReviewedCount(allReviews.length);

        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const reviewsToday = allReviews.filter(review => {
          const reviewDate = review.reviewedAt.toDate();
          return reviewDate >= todayStart;
        });
        setTodayReviewedCount(reviewsToday.length);

        // Weekly chart data
        const weeklyCounts = Array(7).fill(0); // Sun - Sat
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
        currentWeekStart.setHours(0,0,0,0);

        const currentWeekEnd = new Date(currentWeekStart);
        currentWeekEnd.setDate(currentWeekStart.getDate() + 7);


        allReviews.forEach(review => {
          const reviewDate = review.reviewedAt.toDate();
          if (reviewDate >= currentWeekStart && reviewDate < currentWeekEnd) {
            weeklyCounts[reviewDate.getDay()]++;
          }
        });
        
        const chartDataFormatted = dayNames.map((name, index) => ({
          name,
          reviews: weeklyCounts[index],
        }));
        setWeeklyChartData(chartDataFormatted);

      } catch (error: any) {
        console.error("Error fetching stats:", error);
        toast({ title: "Erro ao carregar estatísticas", description: error.message, variant: "destructive" });
      }
      setIsLoading(false);
    };

    fetchStats();
  }, [firestoreDb, userId, appIdPathSegment, loadingAuth, toast]);

  if (isLoading) {
    return <GlobalLoadingSpinner />;
  }
  
  if (!userId && !loadingAuth) {
     return <div className="text-center py-10">Por favor, aguarde a autenticação ou tente recarregar a página.</div>;
  }


  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h2 className="text-3xl font-semibold text-foreground">Estatísticas de Revisão</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Total de Cartões Revisados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-primary">{totalReviewedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cartões Revisados Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-accent">{todayReviewedCount}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Revisões da Semana</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="chart-container h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="reviews" fill="hsl(var(--primary))" name="Revisões" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
