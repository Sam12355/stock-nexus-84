import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Calendar, TrendingUp, Package, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface StockReport {
  id: string;
  name: string;
  category: string;
  current_quantity: number;
  threshold_level: number;
  status: 'critical' | 'low' | 'adequate';
}

interface MovementReport {
  id: string;
  item_name: string;
  movement_type: string;
  quantity: number;
  created_at: string;
  updated_by_name: string;
}

const Reports = () => {
  const { profile } = useAuth();
  const [stockReport, setStockReport] = useState<StockReport[]>([]);
  const [movementReport, setMovementReport] = useState<MovementReport[]>([]);
  const [selectedReport, setSelectedReport] = useState('stock');
  const [loadingStock, setLoadingStock] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [stockLoaded, setStockLoaded] = useState(false);
  const [movementsLoaded, setMovementsLoaded] = useState(false);

  const fetchReportData = useCallback(async () => {
    if (!profile) return;
    // Set loading only when first loading that report type
    if (selectedReport === 'stock') {
      if (!stockLoaded) setLoadingStock(true);
    } else {
      if (!movementsLoaded) setLoadingMovements(true);
    }

    try {
      const branchId = profile.branch_id || profile.branch_context;

      if (selectedReport === 'stock') {
        const { data, error } = await supabase
          .from('items')
          .select(`
            id,
            name,
            category,
            threshold_level,
            stock!inner (
              current_quantity
            )
          `)
          .eq('branch_id', branchId)
          .order('name');

        if (error) throw error;

        const stockData = (data || []).map(item => {
          const currentQty = item.stock?.[0]?.current_quantity || 0;
          const threshold = item.threshold_level;
          
          let status: 'critical' | 'low' | 'adequate' = 'adequate';
          if (currentQty <= threshold * 0.5) status = 'critical';
          else if (currentQty <= threshold) status = 'low';

          return {
            id: item.id,
            name: item.name,
            category: item.category,
            current_quantity: currentQty,
            threshold_level: threshold,
            status
          };
        });

        setStockReport(stockData);
        setStockLoaded(true);
      } else if (selectedReport === 'movements') {
        const { data: movementsRaw, error: movementsError } = await supabase
          .from('stock_movements')
          .select(`
            id,
            item_id,
            movement_type,
            quantity,
            created_at,
            updated_by,
            reason
          `)
          .order('created_at', { ascending: false })
          .limit(50);

        if (movementsError) throw movementsError;

        const movements = movementsRaw || [];
        const itemIds = Array.from(new Set(movements.map(m => m.item_id)));
        const userIds = Array.from(new Set(movements.map(m => m.updated_by).filter(Boolean)));

        // Fetch item names for current branch only
        const { data: itemsData, error: itemsError } = await supabase
          .from('items')
          .select('id, name')
          .eq('branch_id', branchId)
          .in('id', itemIds.length ? itemIds : ['00000000-0000-0000-0000-000000000000']);
        if (itemsError) throw itemsError;
        const itemMap = new Map<string, string>((itemsData || []).map(i => [i.id, i.name]));

        // Fetch user names from profiles
        let profileMap = new Map<string, string>();
        if (userIds.length) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, name')
            .in('user_id', userIds);
          if (profilesError) throw profilesError;
          profileMap = new Map<string, string>((profilesData || []).map(p => [p.user_id, p.name]));
        }

        const movementData: MovementReport[] = movements.map((movement) => ({
          id: movement.id,
          item_name: itemMap.get(movement.item_id) || 'Unknown Item',
          movement_type: movement.movement_type,
          quantity: movement.quantity,
          created_at: movement.created_at,
          updated_by_name: (movement.updated_by && profileMap.get(movement.updated_by)) || 'Unknown User'
        }));

        setMovementReport(movementData);
        setMovementsLoaded(true);
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      if (selectedReport === 'stock') setLoadingStock(false);
      else setLoadingMovements(false);
    }
  }, [profile, selectedReport]);

  useEffect(() => {
    if (profile) {
      fetchReportData();
    }
  }, [profile, fetchReportData]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      case 'adequate':
        return <Badge variant="default">Adequate</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const exportReport = () => {
    // Create CSV data based on selected report
    let csvData = '';
    let fileName = '';

    if (selectedReport === 'stock') {
      csvData = 'Item Name,Category,Current Stock,Threshold,Status\n';
      csvData += stockReport.map(item => 
        `"${item.name}","${item.category}",${item.current_quantity},${item.threshold_level},"${item.status}"`
      ).join('\n');
      fileName = 'stock-report.csv';
    } else if (selectedReport === 'movements') {
      csvData = 'Date,Item,Movement Type,Quantity,Updated By\n';
      csvData += movementReport.map(movement => 
        `"${new Date(movement.created_at).toLocaleDateString()}","${movement.item_name}","${movement.movement_type}",${movement.quantity},"${movement.updated_by_name}"`
      ).join('\n');
      fileName = 'movement-report.csv';
    }

    // Download CSV
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <Button onClick={exportReport} disabled={selectedReport === 'stock' ? (loadingStock && !stockLoaded) : (loadingMovements && !movementsLoaded)}>
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>
      
      <div className="flex gap-4 mb-6">
        <Select value={selectedReport} onValueChange={setSelectedReport}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select report type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stock">Stock Levels Report</SelectItem>
            <SelectItem value="movements">Stock Movements Report</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedReport === 'stock' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Current Stock Levels
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(loadingStock && !stockLoaded) ? (
              <div className="space-y-3">
                <div className="flex gap-4 border-b pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : stockReport.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No stock data found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Item Name</th>
                      <th className="text-left p-2">Category</th>
                      <th className="text-left p-2">Current Stock</th>
                      <th className="text-left p-2">Threshold</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockReport.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-muted/50 odd:bg-muted/30">
                        <td className="p-2 font-medium">{item.name}</td>
                        <td className="p-2 capitalize">{item.category}</td>
                        <td className="p-2">{item.current_quantity}</td>
                        <td className="p-2">{item.threshold_level}</td>
                        <td className="p-2">{getStatusBadge(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedReport === 'movements' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Stock Movement History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(loadingMovements && !movementsLoaded) ? (
              <div className="space-y-3">
                <div className="flex gap-4 border-b pb-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : movementReport.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No movement data found</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="mb-4 flex flex-wrap gap-2">
                  <Badge variant="outline">Total In: {movementReport.filter(m => m.movement_type === 'in').reduce((a, b) => a + b.quantity, 0)}</Badge>
                  <Badge variant="outline">Total Out: {movementReport.filter(m => m.movement_type === 'out').reduce((a, b) => a + b.quantity, 0)}</Badge>
                  <Badge variant="secondary">Net: {movementReport.filter(m => m.movement_type === 'in').reduce((a, b) => a + b.quantity, 0) - movementReport.filter(m => m.movement_type === 'out').reduce((a, b) => a + b.quantity, 0)}</Badge>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Item</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Quantity</th>
                      <th className="text-left p-2">Updated By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementReport.map((movement) => (
                      <tr key={movement.id} className="border-b hover:bg-muted/50 odd:bg-muted/30">
                        <td className="p-2">
                          {new Date(movement.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-2 font-medium">{movement.item_name}</td>
                        <td className="p-2">
                          <Badge variant={movement.movement_type === 'in' ? 'default' : 'secondary'}>
                            {movement.movement_type === 'in' ? 'Stock In' : 'Stock Out'}
                          </Badge>
                        </td>
                        <td className="p-2">{movement.quantity}</td>
                        <td className="p-2">{movement.updated_by_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Reports;