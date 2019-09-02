import React, { memo, useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import uuid from 'uuid/v4';
import { isEqual } from 'lodash-es';
import { attempt } from 'lodash-es';
import { defaultTo } from 'lodash-es';
import isImmutable from 'is-immutable';
import immutableEqual from 'immutable-is';
import { Provider } from '../SeriesContext';
import { getNonEventHandlerProps, getEventsConfig } from '../../utils/events';
import getModifiedProps from '../../utils/getModifiedProps';
import { logSeriesErrorMessage } from '../../utils/warnings';
import usePrevious from '../UsePrevious';

const Series = memo(({children = null, getAxis, getHighcharts, getChart, needsRedraw, ...restProps}) => {

  if (process.env.NODE_ENV === 'development') {
    const { type } = restProps;
    const seriesTypes = Object.keys(getHighcharts().seriesTypes);
    if (seriesTypes.indexOf(type) === -1) logSeriesErrorMessage(type)
  }

  if (defaultTo(restProps.requiresAxis, true)) {
    const axis = getAxis();
    if(!axis) throw new Error(`Series type="${restProps.type}" should be wrapped inside Axis`);
  }


  const seriesRef = useRef();
  const [, setSeriesCreated] = useState(false);

  const series = seriesRef.current;

  useEffect(() => {
    seriesRef.current = createSeries(getChart(), restProps, getAxis);
    setSeriesCreated(true);
    needsRedraw();
    return () => {
      if (seriesRef.current && seriesRef.current.remove) {
        // Series may have already been removed, i.e. when Axis unmounted
        attempt(seriesRef.current.remove.bind(series), false);
        needsRedraw();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const prevProps = usePrevious(restProps);

  useEffect(() => {
    if(!prevProps || !series) return;
    const { visible, data, ...rest } = restProps;

    let doRedraw = false;
    // Using setData is more performant than update
    if (isImmutable(data) && immutableEqual(data, prevProps.data) === false) {
      series.setData(data.toJS(), false);
      doRedraw = true;
    } else if (isEqual(data, prevProps.data) === false) {
      series.setData(data, false);
      doRedraw = true;
    }
    if (visible !== prevProps.visible) {
      series.setVisible(visible, false);
      doRedraw = true;
    }

    const modifiedProps = getModifiedProps(prevProps, rest);
    if (modifiedProps !== false) {
      series.update(modifiedProps, false);
      doRedraw = true;
    }
    if (doRedraw) {
      needsRedraw();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restProps]);

  if(!series) return null;

  return (
    <Provider value={series}>
      {children}
    </Provider>
  );
})

Series.displayName = 'Series';

// TODO remove defaultProps, it is deprecated on functional components
Series.defaultProps = {
  type: 'line',
  id: uuid,
  data: [],
  requiresAxis: true,
  visible: true
}
Series.propTypes = {
  id: PropTypes.oneOfType([ PropTypes.string, PropTypes.func ]).isRequired,
  type: PropTypes.string.isRequired,
  data: PropTypes.any,
  visible: PropTypes.bool,
  getAxis: PropTypes.func // Provided by AxisProvider
}

const getSeriesConfig = (props, getAxis) => {
  const { id, requiresAxis, children, data, ...rest } = props;

  const seriesId = typeof id === 'function' ? id() : id
  const seriesData = isImmutable(data) ? data.toJS() : data;
  const nonEventProps = getNonEventHandlerProps(rest);
  const events = getEventsConfig(rest);

  const config = {
    id: seriesId,
    data: seriesData,
    events,
    ...nonEventProps
  }

  if (defaultTo(requiresAxis, true)) {
    const axis = getAxis();
    config[axis.type] = axis.id;
  }

  return config;
}

const createSeries = (chart, props, getAxis) => {

  // Create Highcharts Series
  const opts = getSeriesConfig(props, getAxis);

  return chart.addSeries(opts, false);
}


export default Series;
