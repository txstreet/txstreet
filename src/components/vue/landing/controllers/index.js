import { getNeededRooms as getNeededRooms1 } from "./statistic";
import { getNeededRooms as getNeededRooms2 } from "./jsonRefresher";
import { getNeededRooms as getNeededRooms3 } from "./transactions";

export const getNeededRooms = () => {
    return getNeededRooms1().concat(getNeededRooms2(),getNeededRooms3()); 
}